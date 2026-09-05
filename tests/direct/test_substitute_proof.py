import json


def manifest(**overrides):
    data = {
        "service_name": "Research Concierge v1",
        "jurisdiction": "Singapore",
        "model_class": "general-reasoning-agent",
        "max_delegation_depth": 1,
        "data_sources": ["provider-docs", "buyer-approved-web"],
        "data_retention_mode": "session-only",
        "capabilities": "Research sources and produce a cited comparison report.",
        "service_description": "A research service that compares buyer-selected options and returns a cited report.",
        "limitations": "No purchases, no account changes, and no delegation beyond one sub-agent.",
    }
    data.update(overrides)
    return data


def j(value):
    return json.dumps(value, separators=(",", ":"))


def create_accept(contract, direct_vm, provider, buyer):
    direct_vm.sender = provider
    agreement_id = contract.create_agreement("deal-001", ("0x" + bytes(buyer).hex()), j(manifest()))
    direct_vm.sender = buyer
    contract.accept_agreement(agreement_id)
    return agreement_id


def state(contract, aid):
    return json.loads(contract.get_agreement(aid))


def prop(contract, pid):
    return json.loads(contract.get_proposal(pid))


def test_critical_change_freezes_without_model(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(manifest(jurisdiction="Canada")), "region change")
    p = prop(contract, pid)
    assert p["outcome"] == "CRITICAL_MATERIAL_SUBSTITUTION"
    assert p["model_called"] is False
    assert state(contract, aid)["status"] == "BUYER_APPROVAL_REQUIRED"


def test_unreported_change_cannot_finalize(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("DELIVERED_MANIFEST_NOT_AUTHORIZED"):
        contract.finalize_handoff(aid, j(manifest(service_description="different service")))


def test_equivalent_prose_substitute_auto_activates(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*SubstituteProof substitution-equivalence gate.*", json.dumps({"decision":"EQUIVALENT_SUBSTITUTE"}))
    candidate = manifest(service_name="Research Concierge 1.0.1")
    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(candidate), "patch")
    assert direct_vm.run_validator() is True
    p = prop(contract, pid)
    assert p["outcome"] == "EQUIVALENT_SUBSTITUTE"
    assert p["model_called"] is True
    assert state(contract, aid)["status"] == "ACTIVE"


def test_material_prose_substitute_needs_buyer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*SubstituteProof substitution-equivalence gate.*", json.dumps({"decision":"MATERIAL_SUBSTITUTION"}))
    candidate = manifest(capabilities="Return an uncited single recommendation only.")
    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(candidate), "weaker output")
    assert direct_vm.run_validator() is True
    assert prop(contract, pid)["outcome"] == "MATERIAL_SUBSTITUTION"
    assert state(contract, aid)["status"] == "BUYER_APPROVAL_REQUIRED"
    with direct_vm.expect_revert("HANDOFF_FROZEN_PENDING_BUYER_APPROVAL"):
        contract.finalize_handoff(aid, j(candidate))


def test_buyer_approval_authorizes_exact_candidate(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    candidate = manifest(data_retention_mode="30-days")
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(candidate), "retention change")
    direct_vm.sender = direct_bob
    contract.approve_substitution(aid)
    direct_vm.sender = direct_alice
    contract.finalize_handoff(aid, j(candidate))
    assert state(contract, aid)["status"] == "COMPLETED"


def test_wrong_actor_cannot_approve(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(manifest(model_class="specialized-agent")), "model class change")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("ONLY_BUYER"):
        contract.approve_substitution(aid)


def test_rejected_candidate_does_not_reroll(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    candidate = manifest(service_name="candidate-x")
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*SubstituteProof substitution-equivalence gate.*", json.dumps({"decision":"MATERIAL_SUBSTITUTION"}))
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(candidate), "first")
    direct_vm.run_validator()
    direct_vm.sender = direct_bob
    contract.reject_substitution(aid)
    direct_vm.clear_mocks()
    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(candidate), "same candidate new note")
    p = prop(contract, pid)
    assert p["outcome"] == "BUYER_REJECTED_CANDIDATE"
    assert p["model_called"] is False


def test_original_baseline_survives_buyer_approved_material_change(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    before = state(contract, aid)
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(manifest(model_class="specialized-agent")), "model class change")
    direct_vm.sender = direct_bob
    contract.approve_substitution(aid)
    after = state(contract, aid)
    assert after["original_manifest_key"] == before["original_manifest_key"]
    assert after["original_manifest_json"] == before["original_manifest_json"]
    assert after["active_manifest_key"] != before["active_manifest_key"]


def test_semantic_budget_requires_buyer_grant(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*SubstituteProof substitution-equivalence gate.*", json.dumps({"decision":"EQUIVALENT_SUBSTITUTE"}))
    direct_vm.sender = direct_alice
    for i in range(3):
        contract.propose_substitution(aid, j(manifest(service_name=f"patch-{i}")), f"patch {i}")
        direct_vm.run_validator()
    pid = contract.propose_substitution(aid, j(manifest(service_name="patch-4")), "patch 4")
    assert prop(contract, pid)["outcome"] == "SEMANTIC_BUDGET_EXHAUSTED"
    with direct_vm.expect_revert("ONLY_BUYER"):
        contract.grant_semantic_budget(aid)
    direct_vm.sender = direct_bob
    contract.grant_semantic_budget(aid)


def test_completion_is_terminal(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    contract.finalize_handoff(aid, j(manifest()))
    with direct_vm.expect_revert("AGREEMENT_NOT_ACTIVE"):
        contract.propose_substitution(aid, j(manifest()), "after complete")


def test_provider_withdraw_restores_liveness_without_authorizing_candidate(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    candidate = manifest(jurisdiction="Canada")
    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(candidate), "region change")
    assert state(contract, aid)["status"] == "BUYER_APPROVAL_REQUIRED"

    contract.withdraw_substitution(aid)
    s = state(contract, aid)
    p = prop(contract, pid)
    assert s["status"] == "ACTIVE"
    assert s["pending_proposal_id"] == ""
    assert s["active_manifest_key"] == s["original_manifest_key"]
    assert p["proposal_status"] == "PROVIDER_WITHDRAWN"

    # Withdrawing is not a reroll or silent approval.
    pid2 = contract.propose_substitution(aid, j(candidate), "same candidate after withdrawal")
    p2 = prop(contract, pid2)
    assert p2["outcome"] == "BUYER_REJECTED_CANDIDATE"
    assert p2["model_called"] is False
    contract.finalize_handoff(aid, j(manifest()))
    assert state(contract, aid)["status"] == "COMPLETED"


def test_rejected_critical_candidate_never_refreezes(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    candidate = manifest(jurisdiction="Canada")
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(candidate), "first")
    direct_vm.sender = direct_bob
    contract.reject_substitution(aid)

    direct_vm.sender = direct_alice
    pid = contract.propose_substitution(aid, j(candidate), "same critical candidate")
    p = prop(contract, pid)
    assert p["outcome"] == "BUYER_REJECTED_CANDIDATE"
    assert p["model_called"] is False
    assert state(contract, aid)["status"] == "ACTIVE"


def test_known_material_candidate_never_auto_activates_without_buyer(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/SubstituteProof.py")
    aid = create_accept(contract, direct_vm, direct_alice, direct_bob)
    candidate = manifest(capabilities="Return a summary with no citations.")
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*SubstituteProof substitution-equivalence gate.*",
        json.dumps({"decision":"MATERIAL_SUBSTITUTION"}),
    )
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(candidate), "first")
    assert direct_vm.run_validator() is True

    direct_vm.sender = direct_bob
    contract.approve_substitution(aid)
    direct_vm.sender = direct_alice
    contract.propose_substitution(aid, j(manifest()), "restore original")
    pid = contract.propose_substitution(aid, j(candidate), "same known material")
    p = prop(contract, pid)
    assert p["outcome"] == "REUSED_MATERIAL_CLASSIFICATION"
    assert p["proposal_status"] == "BUYER_REVIEW"
    assert p["model_called"] is False
    assert state(contract, aid)["status"] == "BUYER_APPROVAL_REQUIRED"
