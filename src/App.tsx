import { useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CONTRACT_ADDRESS, STUDIONET_EXPLORER_URL, VERIFIED_AGREEMENT_ID, CONTRACT_SHA256 } from './config';
import { connectWallet, readJson, readString, writeAndFinalize } from './genlayer';
import type { AgreementRecord, Manifest, ProposalRecord } from './types';

type Page = 'overview' | 'create' | 'propose' | 'review' | 'finalize' | 'inspect' | 'verification';

const EMPTY_MANIFEST: Manifest = {
  service_name: '',
  jurisdiction: '',
  model_class: '',
  max_delegation_depth: -1,
  data_sources: [],
  data_retention_mode: '',
  capabilities: '',
  service_description: '',
  limitations: '',
};

const cloneManifest = (m: Manifest): Manifest => ({ ...m, data_sources: [...m.data_sources] });
const manifestJson = (m: Manifest) => JSON.stringify(m);
const short = (v: string, a = 7, b = 5) => (v ? `${v.slice(0, a)}…${v.slice(-b)}` : '—');
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const criticalFields = ['jurisdiction','model_class','max_delegation_depth','data_sources','data_retention_mode'] as const;

function App() {
  const [page, setPage] = useState<Page>('overview');
  const [contractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [account, setAccount] = useState('');
  const [walletClient, setWalletClient] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('StudioNet ready. Connect a wallet or load an on-chain agreement.');
  const [txHash, setTxHash] = useState('');
  const [agreementId, setAgreementId] = useState('');
  const [agreement, setAgreement] = useState<AgreementRecord | null>(null);
  const [proposal, setProposal] = useState<ProposalRecord | null>(null);

  const [agreementRef, setAgreementRef] = useState('');
  const [buyerHex, setBuyerHex] = useState('');
  const [createManifest, setCreateManifest] = useState<Manifest>(cloneManifest(EMPTY_MANIFEST));
  const [proposalNote, setProposalNote] = useState('');
  const [candidate, setCandidate] = useState<Manifest>(cloneManifest(EMPTY_MANIFEST));
  const [inspectProposalId, setInspectProposalId] = useState('');

  const role = useMemo(() => {
    if (!agreement || !account) return 'Observer';
    if (eq(account, agreement.provider)) return 'Provider';
    if (eq(account, agreement.buyer)) return 'Buyer';
    return 'Observer';
  }, [agreement, account]);

  const activeCriticalDiffs = useMemo(() => agreement ? diffManifest(agreement.original_manifest, agreement.active_manifest).filter(x => x.critical) : [], [agreement]);
  const candidateDiffs = useMemo(() => agreement ? diffManifest(agreement.original_manifest, candidate) : [], [agreement, candidate]);
  const createReady = useMemo(() => {
    const textFields = [
      createManifest.service_name,
      createManifest.jurisdiction,
      createManifest.model_class,
      createManifest.data_retention_mode,
      createManifest.capabilities,
      createManifest.service_description,
      createManifest.limitations,
    ];
    return agreementRef.trim().length > 0
      && /^0x[a-fA-F0-9]{40}$/.test(buyerHex)
      && createManifest.max_delegation_depth >= 0
      && createManifest.data_sources.length > 0
      && textFields.every(v => v.trim().length > 0);
  }, [agreementRef, buyerHex, createManifest]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard.'); }
    catch { setNotice('Copy failed. Select the value manually.'); }
  }

  async function connect() {
    setBusy(true);
    try {
      const x = await connectWallet();
      setAccount(x.account); setWalletClient(x.client);
      setNotice(`Wallet ${short(x.account)} connected to StudioNet.`);
    } catch (e:any) { setNotice(e?.message || String(e)); }
    finally { setBusy(false); }
  }

  async function withWrite(name: string, args: unknown[]) {
    if (!walletClient || !account) throw new Error('Connect a wallet first.');
    setBusy(true); setTxHash(''); setNotice(`Submitting ${name}…`);
    try {
      const result = await writeAndFinalize(walletClient, contractAddress, name, args, h => {
        setTxHash(h); setNotice(`Submitted ${short(h)} — waiting for finalization…`);
      });
      setNotice(`${name} finalized. Verifying durable contract state…`);
      return result;
    } finally { setBusy(false); }
  }

  async function loadAgreement(target = agreementId, hydrateCandidate = true) {
    if (!target) { setNotice('Enter an agreement ID.'); return null; }
    setBusy(true);
    try {
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [target]);
      if (!data) throw new Error('Agreement not found in finalized state.');
      setAgreementId(target); setAgreement(data);
      if (hydrateCandidate) setCandidate(cloneManifest(data.active_manifest));
      if (data.latest_proposal_id) {
        const p = await readJson<ProposalRecord>(contractAddress, 'get_proposal', [data.latest_proposal_id]);
        setProposal(p);
      } else setProposal(null);
      setNotice(`Loaded ${data.agreement_ref} · ${data.status}.`);
      return data;
    } catch (e:any) { setNotice(e?.message || String(e)); return null; }
    finally { setBusy(false); }
  }

  async function loadProposal(id = inspectProposalId) {
    if (!id) { setNotice('Enter a proposal ID.'); return; }
    setBusy(true);
    try {
      const p = await readJson<ProposalRecord>(contractAddress, 'get_proposal', [id]);
      if (!p) throw new Error('Proposal not found.');
      setProposal(p); setInspectProposalId(id); setNotice(`Loaded proposal ${short(id)} · ${p.outcome}.`);
    } catch (e:any) { setNotice(e?.message || String(e)); }
    finally { setBusy(false); }
  }

  async function openVerified() {
    setAgreementId(VERIFIED_AGREEMENT_ID); setPage('inspect');
    await loadAgreement(VERIFIED_AGREEMENT_ID, false);
  }

  async function create() {
    try {
      if (!account) throw new Error('Connect the provider wallet first.');
      if (!/^0x[a-fA-F0-9]{40}$/.test(buyerHex)) throw new Error('Enter a valid buyer address.');
      if (!createReady) throw new Error('Complete every agreement field before creating on StudioNet.');
      const derived = await readString(contractAddress, 'derive_agreement_id', [account, buyerHex, agreementRef]);
      await withWrite('create_agreement', [agreementRef, buyerHex, manifestJson(createManifest)]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [derived]);
      if (!data || data.status !== 'PENDING_BUYER_ACCEPTANCE' || !eq(data.provider, account)) throw new Error('Finalized create did not produce expected agreement state.');
      setAgreementId(derived); setAgreement(data); setCandidate(cloneManifest(data.active_manifest)); setPage('review');
      setNotice('Agreement created and verified. Buyer acceptance is now required.');
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  async function accept() {
    try {
      if (!agreement) throw new Error('Load an agreement first.');
      await withWrite('accept_agreement', [agreement.agreement_id]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [agreement.agreement_id]);
      if (!data || data.status !== 'ACTIVE') throw new Error('Finalized buyer acceptance did not activate the agreement.');
      setAgreement(data); setNotice('Buyer acceptance verified. Original manifest is now the immutable baseline.');
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  async function propose() {
    try {
      if (!agreement) throw new Error('Load an active agreement first.');
      const before = agreement.proposal_count;
      const oldLatest = agreement.latest_proposal_id;
      await withWrite('propose_substitution', [agreement.agreement_id, manifestJson(candidate), proposalNote]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [agreement.agreement_id]);
      if (!data || data.proposal_count !== before + 1 || data.latest_proposal_id === oldLatest) throw new Error('Finalized proposal did not create exactly one new proposal.');
      const p = await readJson<ProposalRecord>(contractAddress, 'get_proposal', [data.latest_proposal_id]);
      if (!p) throw new Error('Latest proposal could not be read after finalization.');
      setAgreement(data); setProposal(p); setInspectProposalId(p.proposal_id);
      setNotice(`Proposal verified: ${p.outcome}; model_called=${String(p.model_called)}.`);
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  async function resolve(action: 'approve'|'reject'|'withdraw') {
    try {
      if (!agreement) throw new Error('Load an agreement first.');
      const method = action === 'approve' ? 'approve_substitution' : action === 'reject' ? 'reject_substitution' : 'withdraw_substitution';
      const pending = agreement.pending_proposal_id;
      await withWrite(method, [agreement.agreement_id]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [agreement.agreement_id]);
      if (!data || data.status !== 'ACTIVE' || data.pending_proposal_id !== '') throw new Error(`${method} did not restore ACTIVE state.`);
      setAgreement(data);
      if (pending) setProposal(await readJson<ProposalRecord>(contractAddress, 'get_proposal', [pending]));
      setCandidate(cloneManifest(data.active_manifest));
      setNotice(`${method} verified in finalized state.`);
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  async function grantBudget() {
    try {
      if (!agreement) throw new Error('Load an agreement first.');
      const before = agreement.budget_grants;
      await withWrite('grant_semantic_budget', [agreement.agreement_id]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [agreement.agreement_id]);
      if (!data || data.budget_grants !== before + 1) throw new Error('Budget grant postcondition did not match.');
      setAgreement(data); setNotice('Buyer semantic-budget grant verified. Existing classifications and rejected candidates remain bound.');
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  async function finalize() {
    try {
      if (!agreement) throw new Error('Load an agreement first.');
      await withWrite('finalize_handoff', [agreement.agreement_id, agreement.active_manifest_json]);
      const data = await readJson<AgreementRecord>(contractAddress, 'get_agreement', [agreement.agreement_id]);
      if (!data || data.status !== 'COMPLETED' || data.completed_manifest_key !== data.active_manifest_key) throw new Error('Finalized handoff did not bind completion to the authorized manifest.');
      setAgreement(data); setNotice('Handoff completion verified against the exact authorized manifest.');
    } catch (e:any) { setNotice(e?.message || String(e)); }
  }

  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('overview')}>
        <img src="/logo.svg" alt="SubstituteProof" />
        <span><b>Substitute<span>Proof</span></b><small>POST-AGREEMENT CHANGE CONTROL</small></span>
      </button>
      <div className="topActions">
        <a className="contractChip" href={STUDIONET_EXPLORER_URL} target="_blank" rel="noreferrer"><i/> <span><small>StudioNet contract</small><b>{short(contractAddress)}</b></span><em>↗</em></a>
        <button className="wallet" disabled={busy} onClick={connect}>{account ? `${role} · ${short(account)}` : 'Connect wallet'}</button>
      </div>
    </header>
    <aside className="sidebar">
      <Nav page={page} id="overview" icon="⌂" label="Overview" set={setPage}/>
      <Nav page={page} id="create" icon="＋" label="Create Agreement" set={setPage}/>
      <Nav page={page} id="propose" icon="⇄" label="Propose Substitute" set={setPage}/>
      <Nav page={page} id="review" icon="✓" label="Buyer Review" set={setPage}/>
      <Nav page={page} id="finalize" icon="◎" label="Finalize Handoff" set={setPage}/>
      <Nav page={page} id="inspect" icon="⌕" label="Inspect State" set={setPage}/>
      <Nav page={page} id="verification" icon="▥" label="Protocol Trace" set={setPage}/>
      <div className="sideSpacer"/>
      <div className="baselineCard"><small>PROTOCOL INVARIANT</small><b>The original stays canonical.</b><p>Every substitute is evaluated against the buyer-accepted baseline.</p></div>
    </aside>
    <main className="main">
      <StatusBar notice={notice} txHash={txHash} busy={busy}/>
      {page === 'overview' && <Overview openVerified={openVerified} go={setPage}/>} 
      {page === 'create' && <Page title="Create an agreement" subtitle="Declare the service terms, choose the buyer, and anchor the original manifest on StudioNet. Nothing is prefilled: the provider signs exactly what is entered.">
        <div className="twoCol"><section className="panel">
          <Field label="Agreement reference" hint="A short identifier for this deal"><input placeholder="e.g. compliance-retainer-q4" value={agreementRef} onChange={e=>setAgreementRef(e.target.value)}/></Field>
          <Field label="Buyer address" hint="Must differ from the connected provider"><input placeholder="0x…" value={buyerHex} onChange={e=>setBuyerHex(e.target.value)}/></Field>
          <ManifestEditor value={createManifest} setValue={setCreateManifest}/>
          <button className="primary" disabled={busy || !account || !createReady} onClick={create}>Create on StudioNet</button>
        </section><aside><SealCard title="Signer" state={account ? `Provider · ${short(account)}` : 'Connect provider wallet'} tone="mint"/><SealCard title="Next state" state="Buyer acceptance seals the baseline" tone="amber"/><SealCard title="Protocol rule" state="Original terms remain the comparison anchor"/></aside></div>
      </Page>}
      {page === 'propose' && <Page title="Propose a substitute" subtitle="Stage a candidate against the immutable buyer-accepted original. Critical structured changes are deterministic; prose-only changes use GenLayer consensus.">
        <AgreementLoader id={agreementId} setId={setAgreementId} load={() => loadAgreement(agreementId)} busy={busy} verified={() => {setAgreementId(VERIFIED_AGREEMENT_ID); void loadAgreement(VERIFIED_AGREEMENT_ID);}}/>
        {agreement ? <><div className="compareHeader"><div><small>ORIGINAL BASELINE</small><b>{short(agreement.original_manifest_key,10,8)}</b></div><span>vs</span><div><small>CANDIDATE</small><b>{candidateDiffs.length ? `${candidateDiffs.length} changed field${candidateDiffs.length>1?'s':''}` : 'No differences'}</b></div></div>
          <div className="diffGrid"><ManifestRead title="Original · locked" manifest={agreement.original_manifest} locked/><ManifestEditor value={candidate} setValue={setCandidate} compact/></div>
          <DiffRail diffs={candidateDiffs}/>
          <Field label="Proposal note" hint="Optional context. Not part of the semantic comparison."><textarea placeholder="Describe why this substitute is being proposed" value={proposalNote} onChange={e=>setProposalNote(e.target.value)}/></Field>
          <button className="primary" disabled={busy || role !== 'Provider' || agreement.status !== 'ACTIVE'} onClick={propose}>Evaluate substitute</button>
          {proposal && <ProposalResult proposal={proposal}/>}</> : <Empty text="Load an agreement to stage a candidate."/>}
      </Page>}
      {page === 'review' && <Page title="Buyer review" subtitle="Only material substitutions require buyer action. Equivalent prose changes auto-activate by design; buyer review is reserved for material candidates.">
        <AgreementLoader id={agreementId} setId={setAgreementId} load={() => loadAgreement(agreementId,false)} busy={busy} verified={() => {setAgreementId(VERIFIED_AGREEMENT_ID); void loadAgreement(VERIFIED_AGREEMENT_ID,false);}}/>
        {agreement ? <div className="twoCol"><section className="panel">
          <AgreementSummary a={agreement} role={role}/>
          {agreement.status === 'PENDING_BUYER_ACCEPTANCE' ? <div className="actionBlock"><h3>Buyer acceptance required</h3><p>Acceptance seals the original manifest as the immutable baseline.</p><button className="primary" disabled={busy || role!=='Buyer'} onClick={accept}>Accept original agreement</button></div> : agreement.status === 'BUYER_APPROVAL_REQUIRED' ? <><ProposalResult proposal={proposal}/><div className="buttonRow"><button className="primary amber" disabled={busy || role!=='Buyer'} onClick={()=>resolve('approve')}>Buyer · approve substitute</button><button className="secondary" disabled={busy || role!=='Buyer'} onClick={()=>resolve('reject')}>Buyer · reject</button><button className="ghostDanger" disabled={busy || role!=='Provider'} onClick={()=>resolve('withdraw')}>Provider · withdraw</button></div></> : <div className="actionBlock done"><h3>{agreement.status === 'COMPLETED' ? 'Agreement completed' : 'No buyer action pending'}</h3><p>{agreement.status === 'ACTIVE' ? 'The active manifest is currently authorized.' : 'Completion is terminal.'}</p></div>}
          {agreement.status === 'ACTIVE' && role === 'Buyer' && <button className="secondary" disabled={busy || agreement.budget_grants>=5} onClick={grantBudget}>Grant +3 semantic calls</button>}
        </section><aside><ManifestRead title="Original · immutable" manifest={agreement.original_manifest} locked/><ManifestRead title="Currently authorized" manifest={agreement.active_manifest}/></aside></div> : <Empty text="Load an agreement to review buyer actions."/>}
      </Page>}
      {page === 'finalize' && <Page title="Finalize the authorized handoff" subtitle="Finalization is allowed only while ACTIVE and only when the delivered manifest hashes to the exact currently authorized manifest.">
        <AgreementLoader id={agreementId} setId={setAgreementId} load={() => loadAgreement(agreementId,false)} busy={busy} verified={() => {setAgreementId(VERIFIED_AGREEMENT_ID); void loadAgreement(VERIFIED_AGREEMENT_ID,false);}}/>
        {agreement ? <div className="twoCol"><section className="panel"><AgreementSummary a={agreement} role={role}/><div className="bindingStrip"><span>Delivered manifest</span><b>must equal</b><span>active_manifest_key</span></div><ManifestRead title="Authorized delivery manifest" manifest={agreement.active_manifest}/><button className="primary" disabled={busy || role!=='Provider' || agreement.status!=='ACTIVE'} onClick={finalize}>{agreement.status==='COMPLETED'?'Completed':'Finalize exact authorized manifest'}</button></section><aside><SealCard title="Original key" state={short(agreement.original_manifest_key,10,8)}/><SealCard title="Active key" state={short(agreement.active_manifest_key,10,8)} tone="mint"/><SealCard title="Pending" state={agreement.pending_proposal_id ? short(agreement.pending_proposal_id) : 'None'}/></aside></div> : <Empty text="Load an agreement to verify the authorized delivery manifest."/>}
      </Page>}
      {page === 'inspect' && <Page title="Inspect finalized state" subtitle="Read agreement state and proposal history directly from StudioNet.">
        <AgreementLoader id={agreementId} setId={setAgreementId} load={() => loadAgreement(agreementId,false)} busy={busy} verified={openVerified}/>
        <div className="inspectInput"><input placeholder="Optional proposal ID" value={inspectProposalId} onChange={e=>setInspectProposalId(e.target.value)}/><button className="secondary" disabled={!inspectProposalId || busy} onClick={()=>loadProposal()}>Load proposal</button></div>
        {agreement && <><AgreementSummary a={agreement} role={role}/><div className="inspectGrid"><JsonCard title="Agreement" data={agreement}/><JsonCard title="Proposal" data={proposal}/></div></>}
      </Page>}
      {page === 'verification' && <ProtocolTrace openVerified={openVerified}/>} 
    </main>
  </div>;
}

function Nav({page,id,icon,label,set}:{page:Page,id:Page,icon:string,label:string,set:(p:Page)=>void}) { return <button className={`nav ${page===id?'active':''}`} onClick={()=>set(id)}><span>{icon}</span>{label}</button>; }
function StatusBar({notice,txHash,busy}:{notice:string,txHash:string,busy:boolean}) { return <div className="statusBar"><i className={busy?'pulse':''}/><small>STUDIONET</small><span>{notice}</span>{txHash && <code>{short(txHash,8,6)}</code>}</div>; }
function Page({title,subtitle,children}:{title:string,subtitle:string,children:ReactNode}) { return <div className="page"><div className="eyebrow">SUBSTITUTEPROOF · LIVE PROTOCOL</div><h1>{title}</h1><p className="subtitle">{subtitle}</p>{children}</div>; }
function Field({label,hint,children}:{label:string,hint?:string,children:ReactNode}) { return <label className="field"><span><b>{label}</b>{hint && <small>{hint}</small>}</span>{children}</label>; }
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }

function Overview({openVerified,go}:{openVerified:()=>void,go:(p:Page)=>void}) { return <div className="overview page">
  <div className="hero protocolHero">
    <div className="heroCopy">
      <div className="eyebrow">POST-AGREEMENT CHANGE CONTROL · STUDIONET</div>
      <h1>Lock the original.<br/><span>Gate every substitute.</span></h1>
      <p>SubstituteProof keeps the buyer-accepted manifest as the permanent reference point. Structured critical changes freeze immediately; prose-only changes pass through one bounded material-equivalence decision.</p>
      <div className="heroActions"><button className="primary" onClick={()=>go('create')}>Create agreement</button><button className="secondary" onClick={()=>go('propose')}>Evaluate a substitute</button></div>
      <div className="tagRow"><span>◎ Original anchored</span><span>◇ Deterministic critical gate</span><span>⇄ Buyer-controlled handoff</span></div>
    </div>
    <div className="protocolArt" aria-label="Original agreement compared to a substitute through a materiality gate">
      <div className="meshGlow"/>
      <div className="protocolNode originalNode"><small>ORIGINAL</small><b>LOCKED</b><code>buyer-accepted</code><i/></div>
      <div className="gateNode"><span>⇄</span><small>MATERIALITY GATE</small><b>critical / semantic</b></div>
      <div className="protocolNode candidateNode"><small>SUBSTITUTE</small><b>CONSENT-BOUND</b><code>provider-proposed</code><i/></div>
      <div className="traceLine"/>
    </div>
    <div className="liveContract"><div><i/><span><small>LIVE CONTRACT</small><b>StudioNet</b></span></div><code>{short(DEFAULT_CONTRACT_ADDRESS,12,8)}</code><a href={STUDIONET_EXPLORER_URL} target="_blank" rel="noreferrer">Explorer ↗</a></div>
  </div>
  <div className="sectionLabel"><span>PROTOCOL FLOW</span><em>ORIGINAL → GATE → CONSENT → HANDOFF</em></div>
  <div className="flow"><Flow n="01" title="Anchor original" text="Buyer acceptance seals the provider-declared manifest."/><Flow n="02" title="Stage substitute" text="Every candidate is compared to the immutable original."/><Flow n="03" title="Gate material drift" text="Critical drift freezes; semantic drift is bounded by consensus."/><Flow n="04" title="Authorize handoff" text="Only the current authorized manifest can complete."/></div>
  <div className="sectionLabel"><span>PROTOCOL LAYERS</span><em>DETERMINISTIC · CONSENSUS · ON-CHAIN STATE</em></div>
  <div className="featureGrid"><button onClick={()=>go('propose')}><small>RULE LAYER</small><b>Critical fields never reach the model</b><p>Jurisdiction, model class, delegation depth, data sources and retention changes become material deterministically.</p></button><button onClick={()=>go('review')}><small>CONSENSUS LAYER</small><b>One narrow equivalence question</b><p>Validators only judge whether non-critical prose remains materially equivalent to the original accepted manifest.</p></button><button onClick={()=>go('verification')}><small>STATE LAYER</small><b>Inspect the protocol trace</b><p>Role boundaries, freeze behavior, anti-reroll, original-baseline anchoring and terminal completion are visible from finalized StudioNet state.</p><strong>Open protocol trace →</strong></button></div>
</div>; }
function Flow({n,title,text}:{n:string,title:string,text:string}) { return <div><span>{n}</span><b>{title}</b><small>{text}</small></div>; }

function AgreementLoader({id,setId,load,busy,verified}:{id:string,setId:(v:string)=>void,load:()=>void,busy:boolean,verified:()=>void}) { return <div className="loader"><input placeholder="Paste finalized agreement ID" value={id} onChange={e=>setId(e.target.value)}/><button className="secondary" disabled={busy||!id} onClick={load}>Load agreement</button><button className="linkButton" onClick={verified}>Load StudioNet case</button></div>; }

function ManifestEditor({value,setValue,compact=false}:{value:Manifest,setValue:(m:Manifest)=>void,compact?:boolean}) {
  const set = <K extends keyof Manifest>(k:K,v:Manifest[K])=>setValue({...value,[k]:v});
  return <div className={`manifestEditor ${compact?'compact':''}`}>
    {!compact && <div className="manifestTitle"><span>Service manifest</span><small>Exact 9-field schema</small></div>}
    <div className="formGrid"><Field label="Service name"><input placeholder="Enter service name" value={value.service_name} onChange={e=>set('service_name',e.target.value)}/></Field><Field label="Jurisdiction"><input placeholder="Enter jurisdiction" value={value.jurisdiction} onChange={e=>set('jurisdiction',e.target.value)}/></Field><Field label="Model class"><input placeholder="Enter model class" value={value.model_class} onChange={e=>set('model_class',e.target.value)}/></Field><Field label="Delegation depth"><input type="number" min="0" max="16" placeholder="0–16" value={value.max_delegation_depth < 0 ? '' : value.max_delegation_depth} onChange={e=>set('max_delegation_depth',e.target.value === '' ? -1 : Number(e.target.value))}/></Field></div>
    <Field label="Data sources" hint="One source per line"><textarea placeholder="List the declared sources" value={value.data_sources.join('\n')} onChange={e=>set('data_sources',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></Field>
    <Field label="Data retention mode"><input placeholder="Describe retention policy" value={value.data_retention_mode} onChange={e=>set('data_retention_mode',e.target.value)}/></Field>
    <Field label="Capabilities"><textarea placeholder="What the service is allowed to do" value={value.capabilities} onChange={e=>set('capabilities',e.target.value)}/></Field>
    <Field label="Service description"><textarea placeholder="Describe the agreed service" value={value.service_description} onChange={e=>set('service_description',e.target.value)}/></Field>
    <Field label="Limitations"><textarea placeholder="Declare explicit limitations" value={value.limitations} onChange={e=>set('limitations',e.target.value)}/></Field>
  </div>;
}

function ManifestRead({title,manifest,locked=false}:{title:string,manifest:Manifest,locked?:boolean}) { return <div className={`manifestRead ${locked?'locked':''}`}><div className="manifestTitle"><span>{title}</span><small>{locked?'SEALED BASELINE':'AUTHORIZED'}</small></div>{Object.entries(manifest).map(([k,v])=><div className="manifestRow" key={k}><small>{pretty(k)}</small><span>{Array.isArray(v)?v.join(' · '):String(v)}</span></div>)}</div>; }
function pretty(k:string){return k.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());}
function normalizeField(k:keyof Manifest,v:Manifest[keyof Manifest]){if(k==='data_sources')return [...new Set((v as string[]).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean))].sort();if(typeof v==='string')return v.trim().replace(/\s+/g,' ');return v;}
function diffManifest(a:Manifest,b:Manifest){return (Object.keys(a) as (keyof Manifest)[]).filter(k=>JSON.stringify(normalizeField(k,a[k]))!==JSON.stringify(normalizeField(k,b[k]))).map(k=>({field:String(k),critical:(criticalFields as readonly string[]).includes(String(k)),from:a[k],to:b[k]}));}
function DiffRail({diffs}:{diffs:ReturnType<typeof diffManifest>}) { return <div className="diffRail"><div><small>CHANGE SCAN</small><b>{diffs.length ? `${diffs.length} declared change${diffs.length>1?'s':''}`:'Candidate matches original'}</b></div>{diffs.map(d=><span className={d.critical?'critical':'semantic'} key={d.field}>{d.critical?'CRITICAL':'SEMANTIC'} · {pretty(d.field)}</span>)}{!diffs.length&&<span className="neutral">NO CHANGE</span>}</div>; }

function ProposalResult({proposal}:{proposal:ProposalRecord|null}) { if(!proposal) return null; const material=proposal.outcome.includes('MATERIAL')||proposal.proposal_status==='BUYER_REVIEW'; return <div className={`proposalResult ${material?'material':'safe'}`}><div><small>PROPOSAL STATE</small><b>{proposal.outcome}</b></div><div className="resultStats"><span><small>Status</small><b>{proposal.proposal_status}</b></span><span><small>Model called</small><b>{proposal.model_called?'Yes':'No'}</b></span><span><small>Critical changes</small><b>{proposal.critical_changes.length?proposal.critical_changes.join(', '):'None'}</b></span></div><code>{short(proposal.proposal_id,12,8)}</code></div>; }
function AgreementSummary({a,role}:{a:AgreementRecord,role:string}) { return <div className="agreementSummary"><div className="summaryTop"><StatusPill status={a.status}/><b>{a.agreement_ref}</b><span>Role: {role}</span></div><div className="statGrid"><Stat label="Proposals" value={String(a.proposal_count)}/><Stat label="Semantic calls" value={`${a.semantic_calls_total}/${3*(1+a.budget_grants)}`}/><Stat label="Budget grants" value={String(a.budget_grants)}/><Stat label="Rejected candidates" value={String(Object.keys(a.rejected_candidates||{}).length)}/></div><div className="keyLine"><span>Original <code>{short(a.original_manifest_key,10,8)}</code></span><span>Active <code>{short(a.active_manifest_key,10,8)}</code></span></div></div>; }
function Stat({label,value}:{label:string,value:string}){return <div><small>{label}</small><b>{value}</b></div>}
function StatusPill({status}:{status:string}){return <span className={`statusPill ${status.toLowerCase()}`}>{status}</span>}
function SealCard({title,state,tone='plain'}:{title:string,state:string,tone?:string}){return <div className={`sealCard ${tone}`}><small>{title}</small><b>{state}</b></div>}
function JsonCard({title,data}:{title:string,data:any}){return <div className="jsonCard"><div><small>{title}</small>{data&&<button onClick={()=>navigator.clipboard.writeText(JSON.stringify(data,null,2))}>Copy JSON</button>}</div><pre>{data?JSON.stringify(data,null,2):'No data loaded.'}</pre></div>}

function ProtocolTrace({openVerified}:{openVerified:()=>void}) { const items=[
  ['Role boundary','Provider buyer-only actions roll back; buyer/provider permissions remain separated.'],
  ['Critical-field gate','Jurisdiction and retention changes became material with model_called=false.'],
  ['Frozen handoff','Finalize while buyer approval was pending rolled back deterministically.'],
  ['Withdrawal + anti-reroll','Provider can retreat without authorizing the candidate; the withdrawn candidate remains blocked.'],
  ['Equivalent substitute','A prose-only equivalent candidate reached EQUIVALENT_SUBSTITUTE and auto-activated.'],
  ['Material substitute','Capability loss reached MATERIAL_SUBSTITUTION and required buyer review.'],
  ['Original-baseline anchor','A later change still compared against the buyer-accepted original rather than an intermediate substitute.'],
  ['Bound completion','An old manifest could not finalize; the authorized manifest completed; post-completion substitution rolled back.'],
]; return <Page title="Protocol trace" subtitle="Follow the finalized StudioNet state transitions that define how SubstituteProof behaves in practice."><div className="verificationLayout"><div className="verificationTimeline">{items.map(([a,b],i)=><div key={a} className="verificationStep"><span>{String(i+1).padStart(2,'0')}</span><div><small>STATE TRANSITION</small><b>{a}</b><p>{b}</p></div></div>)}</div><aside><div className="evidenceCard"><small>LIVE CONTRACT</small><b>{short(DEFAULT_CONTRACT_ADDRESS,12,8)}</b><a href={STUDIONET_EXPLORER_URL} target="_blank" rel="noreferrer">View on Explorer ↗</a></div><div className="evidenceCard"><small>CODE IDENTITY</small><code>{CONTRACT_SHA256}</code><b className="verified">Source match confirmed</b></div><div className="evidenceCard featured"><small>REFERENCE AGREEMENT</small><code>{VERIFIED_AGREEMENT_ID}</code><button className="primary" onClick={openVerified}>Open on-chain state</button></div></aside></div></Page>; }

export default App;
