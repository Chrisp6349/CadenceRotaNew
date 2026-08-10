# CADEX -- Cadence--Atrium Data Exchange

## Collaborative Integration Proposal

**Version:** 1.0 (Draft)

**Date:** August 2026

**Author:** Chris Parrish

**Recipient:** Craig

------------------------------------------------------------------------

> **Status:** Proposal for Review
>
> This document proposes a collaborative integration between **Cadence**
> and **The Atrium** to enable secure, reliable and automated sharing of
> operational rota information across the Cardiothoracic Theatre
> Department.
>
> It is intended to form the agreed technical specification before any
> development work begins.

------------------------------------------------------------------------

# Executive Summary

The Cardiothoracic Theatre Department currently relies on two
independently developed web applications to manage daily operational
information.

**Cadence** provides theatre management, ODP allocations, surgeon
on-call information and live departmental displays.

**The Atrium** provides consultant anaesthetist allocations, consultant
on-call information and CICU allocations.

Both applications are highly valuable within their own areas of
responsibility.

However, both contain information that is useful to the other.

At present this information exists independently, requiring duplicate
administration and creating the possibility of inconsistencies between
systems.

The objective of this proposal is to establish a secure, reliable and
maintainable integration framework allowing both applications to
exchange operational rota information automatically whilst ensuring that
ownership of data always remains with the originating application.

The proposed integration has been named:

# CADEX

**Cadence--Atrium Data Exchange**

CADEX is not simply an API.

It is a collaborative integration framework that defines:

-   how information is exchanged
-   who owns each dataset
-   how synchronisation occurs
-   how failures are handled
-   how future changes are managed

The design intentionally avoids unnecessary complexity.

It is based upon straightforward engineering principles that prioritise
reliability, maintainability and ease of deployment over technical
novelty.

------------------------------------------------------------------------

# Introduction

Hi Craig,

Over the past year Cadence has gradually evolved from being a theatre
rota application into a much broader operational platform for our
department.

It now manages multiple clinical workflows including theatre
allocations, ODP rotas, corridor displays, nursing information, staff
management and departmental communication.

While developing Cadence it became increasingly obvious that one area of
duplicated effort still exists.

Consultant anaesthetist allocations are already managed extremely well
within **The Atrium**.

Likewise, Cadence already maintains information that would benefit The
Atrium, including:

-   ODP theatre allocations
-   ODP on-call allocations
-   Weekend waiting list ODP allocation
-   Cardiac surgeon on-call
-   Thoracic surgeon on-call

Rather than maintaining overlapping information within two separate
systems, I believe both applications would benefit from securely sharing
the information that each already owns.

The objective is not to merge the two applications.

Nor is it to replace either system.

Instead, the objective is to allow both applications to remain
completely independent whilst exchanging only the information that is
valuable to the other.

This proposal outlines the architecture that I believe achieves that
objective with minimal complexity, minimal ongoing maintenance and no
additional operational burden for either application.

------------------------------------------------------------------------

# Why CADEX Exists

The purpose of CADEX is not simply to automate data transfer.

Its purpose is to improve operational awareness across the
Cardiothoracic Theatre Department.

Every day our teams need immediate visibility of:

-   who is working in each theatre
-   which consultant anaesthetist is allocated
-   which ODP is supporting that list
-   who is covering CICU
-   who is on call
-   where staffing gaps exist

The more accurate and current this information is, the easier it becomes
for the department to coordinate activity and respond to changes
throughout the day.

Currently both Cadence and The Atrium maintain information that
contributes to this operational picture.

By allowing each application to automatically exchange its own
specialist data, both systems become more useful whilst avoiding
duplicated administration.

The guiding philosophy is simple:

> **Information should be entered once, owned once and trusted
> everywhere.**

------------------------------------------------------------------------

# Project Vision

The vision for CADEX is to create a lightweight integration framework
that allows independently developed departmental applications to
exchange trusted operational data without sacrificing their
independence.

CADEX has been designed around five core objectives.

## 1. Eliminate Duplicate Data Entry

Where information already exists within one application it should not
require manual entry into another.

## 2. Preserve Data Ownership

Every dataset should have one authoritative owner.

No application should edit another application's master data.

## 3. Maintain Operational Reliability

Clinical users must continue to see accurate information even if one
application becomes temporarily unavailable.

Previously synchronised data should remain visible until fresh
information becomes available.

## 4. Minimise Operational Costs

The proposed architecture should utilise the existing infrastructure
supporting both applications.

No additional paid services should be required where avoidable.

## 5. Support Long-Term Maintainability

Both Cadence and The Atrium should remain free to evolve independently.

Future internal changes must not require redevelopment of the
integration provided that the agreed API contract remains unchanged.

------------------------------------------------------------------------

# Existing Systems Overview

## Cadence

Cadence is the departmental operational platform responsible for:

-   Theatre allocations
-   ODP rota management
-   Corridor display board
-   Nursing rota management
-   Staff management
-   Department dashboard
-   Live operational displays

Cadence will remain the authoritative source for:

-   ODP theatre allocations
-   ODP on-call
-   Weekend waiting list ODP
-   Cardiac surgeon on-call
-   Thoracic surgeon on-call

## The Atrium

The Atrium is responsible for consultant anaesthetic allocations within
the department.

It currently manages:

-   CT1
-   CT2
-   CT3
-   CT4
-   CT5
-   Cath Lab (CL)
-   CICU
-   Consultant On Call

The Atrium will remain the authoritative source for all consultant
anaesthetist allocations.

------------------------------------------------------------------------

# Current Challenges

-   Duplicate administration.
-   Data inconsistency.
-   Delayed communication.
-   Manual verification across systems.

------------------------------------------------------------------------

# Design Philosophy

> **Clinical reliability is more important than technical complexity.**

Every design decision described within this proposal has therefore been
evaluated against four questions:

-   Does it improve reliability?
-   Does it reduce administration?
-   Does it simplify maintenance?
-   Does it protect the integrity of departmental data?

------------------------------------------------------------------------

# Guiding Principles

1.  Each application remains the sole owner of its own data.
2.  Neither application directly edits another application's master
    data.
3.  Data exchange occurs only through authenticated APIs.
4.  Internal databases remain private and are never accessed directly by
    external systems.
5.  Synchronisation occurs automatically every 60 seconds.
6.  Existing information remains visible during communication failures.
7.  Imported information is clearly identifiable.
8.  Local overrides are permitted where operationally necessary.
9.  Users are warned before imported information replaces a local
    override.
10. The integration should require no additional paid infrastructure
    wherever possible.
11. Both applications remain fully functional should the integration
    become temporarily unavailable.
12. Simplicity, maintainability and reliability take priority over
    unnecessary technical complexity.

------------------------------------------------------------------------

# CADEX -- Cadence--Atrium Data Exchange

## Collaborative Integration Proposal

### Part 2 -- Technical Architecture & Integration Strategy

# 6. Technical Architecture

## 6.1 Architectural Overview

CADEX has been designed to provide a secure, reliable and maintainable
method of exchanging operational rota information between **Cadence**
and **The Atrium**.

The architecture deliberately avoids tight coupling between the two
applications.

Each application remains entirely independent, maintaining its own
database, authentication model and internal business logic.

The only shared component is a lightweight, authenticated REST API
exposed by each application.

Neither application has knowledge of the other's database structure.

Neither application is permitted to read or modify the other's database
directly.

Instead, each application requests only the agreed operational
information through the published CADEX interface.

This approach ensures that internal development can continue
independently without breaking the integration.

# 6.2 Design Objectives

-   Preserve a single source of truth.
-   Remove duplicate data entry.
-   Prevent database coupling.
-   Minimise operational complexity.
-   Require no additional paid infrastructure.
-   Remain simple to maintain.
-   Support future API versioning.
-   Operate reliably within a clinical environment.

# 6.3 System Architecture

``` mermaid
flowchart LR
    subgraph Cadence
        C1[Cadence Application]
        C2[Cadence Firestore]
        C3[CADEX Provider API]
        C4[CADEX Consumer]
    end
    subgraph Atrium
        A1[The Atrium]
        A2[Atrium Database]
        A3[CADEX Provider API]
        A4[CADEX Consumer]
    end
    C1 --> C2
    C2 --> C3
    C4 --> C1
    A1 --> A2
    A2 --> A3
    A4 --> A1
    C4 -->|Consultant Requests| A3
    A4 -->|ODP Requests| C3
```

# 7. Why APIs Were Chosen

## Option 1 --- Screen Scraping (Rejected)

-   Fragile if layouts change.
-   Difficult to maintain.
-   Impossible to version.

## Option 2 --- Shared Database (Rejected)

-   Exposes internal database structure.
-   Creates tight coupling.
-   Reduces security.

## Option 3 --- Authenticated APIs (Selected)

Chosen because it provides:

-   Clear ownership.
-   Security.
-   Versioning.
-   Independence.
-   Future scalability.

# 8. Data Ownership Model

## Cadence Owns

-   Theatre ODP allocations
-   ODP On Call
-   Weekend Waiting List ODP
-   Cardiac Surgeon On Call
-   Thoracic Surgeon On Call

## The Atrium Owns

-   CT1
-   CT2
-   CT3
-   CT4
-   CT5
-   Cath Lab
-   CICU
-   Consultant On Call

# 9. Provider and Consumer Roles

Cadence is: - Provider of ODP and surgeon data. - Consumer of consultant
data.

The Atrium is: - Provider of consultant data. - Consumer of ODP and
surgeon data.

# 10. Synchronisation Strategy

-   Automatic every 60 seconds.
-   No user interaction.
-   Validate responses.
-   Apply mappings.
-   Update displays.

# 11. Authentication

Every request must contain a permanent API key.

Example:

``` http
Authorization: Bearer xxxxxxxxxxxxxxxxx
```

# 12. API Versioning

    /api/v1/consultants
    /api/v1/odp
    /api/v1/status

# 13. Operational Resilience

If communication fails:

-   Keep displaying last known good data.
-   Record failure.
-   Retry after 60 seconds.
-   Never clear rota information because of an API failure.

# 14. Local Override Behaviour

Imported consultant data populates Cadence automatically.

If a later import conflicts with a local override, Cadence asks the user
whether they wish to replace the local value.

# Engineering Decisions

-   Authenticated REST APIs
-   60 second polling
-   Permanent API key
-   Single source of truth
-   Last known good data retained
-   No screen scraping
-   No shared database

------------------------------------------------------------------------

# CADEX -- Cadence--Atrium Data Exchange

## Collaborative Integration Proposal

### Part 3 -- API Contract & Data Exchange Specification

# 15. API Design Principles

The CADEX API is the only approved communication mechanism between
Cadence and The Atrium.

Each application SHALL expose a read-only API containing only the data
owned by that application.

Databases, internal collections and implementation details MUST remain
private.

------------------------------------------------------------------------

# 16. Endpoints

## Atrium → Cadence

### GET /api/v1/consultants

Returns consultant rota information for the requested operational week.

### GET /api/v1/status

Returns API version, status and last update timestamp.

------------------------------------------------------------------------

## Cadence → Atrium

### GET /api/v1/odp

Returns ODP theatre allocations.

### GET /api/v1/surgeons

Returns Cardiac and Thoracic surgeon on-call allocations.

### GET /api/v1/status

Returns API health information.

------------------------------------------------------------------------

# 17. Authentication

All requests SHALL include:

``` http
Authorization: Bearer <API_KEY>
```

Invalid or missing keys SHALL return HTTP 401.

------------------------------------------------------------------------

# 18. Consultant Mapping

  Atrium    Cadence                     Rule
  --------- --------------------------- -----------------
  CT1       Theatre 1                   Direct
  CT2       Theatre 2                   Direct
  CT3       THORACIC CT3 → Cath Lab     Thursday only
  CT4       Theatre 4                   Direct
  CT5       Theatre 5                   Monday--Friday
  CT5       Waiting List Anaesthetist   Saturday/Sunday
  CL        Cath Lab                    Direct
  CICU      New ODP On Call section     Direct
  On Call   Consultant On Call          Direct

------------------------------------------------------------------------

# 19. Cadence Export

Cadence SHALL export:

-   Theatre 1 ODP
-   Theatre 2 ODP
-   Theatre 4 ODP
-   Theatre 5 ODP
-   Cath Lab ODP
-   ODP On Call
-   Weekend Waiting List ODP
-   Cardiac Surgeon On Call
-   Thoracic Surgeon On Call

------------------------------------------------------------------------

# 20. Example Consultant Response

``` json
{
  "weekCommencing":"2026-08-03",
  "lastUpdated":"2026-08-03T08:30:00Z",
  "monday":{
    "ct1":"PJ",
    "ct2":"SB",
    "ct3":"MC",
    "ct4":"JA",
    "ct5":"LC",
    "cl":"TG",
    "cicu":"VR",
    "onCall":"NM"
  }
}
```

------------------------------------------------------------------------

# 21. Synchronisation Rules

1.  Poll every 60 seconds.
2.  Validate API key.
3.  Validate JSON.
4.  Apply mapping rules.
5.  Update dropdowns automatically.
6.  Preserve local overrides.
7.  Prompt before replacing overrides.
8.  Record successful synchronisation.

------------------------------------------------------------------------

# 22. Error Handling

  Condition            Behaviour
  -------------------- -------------------------------
  API unavailable      Keep last known data
  Invalid JSON         Ignore update and log
  Invalid API key      Reject request
  Unknown consultant   Leave field unchanged and log
  Missing field        Ignore field and continue

------------------------------------------------------------------------

# 23. Status Dashboard

Cadence SHOULD provide a CADEX dashboard displaying:

-   Connection status
-   API version
-   Last successful import
-   Last successful export
-   Last failed synchronisation
-   Poll interval
-   Manual sync button
-   Test connection button

------------------------------------------------------------------------

# Engineering Decisions

-   Read-only APIs only.
-   JSON as exchange format.
-   Automatic polling every 60 seconds.
-   One authoritative owner per dataset.
-   Preserve last known good data.
-   Confirmation before replacing local overrides.

End of Part 3.

------------------------------------------------------------------------

# CADEX -- Cadence--Atrium Data Exchange

## Collaborative Integration Proposal

### Part 4 -- Testing, Governance & Conclusion

# 24. Testing Strategy

Before deployment both Cadence and The Atrium SHALL independently
verify:

-   Successful API authentication.
-   Correct JSON validation.
-   Correct field mapping.
-   Successful synchronisation every 60 seconds.
-   Local override prompts.
-   Recovery following temporary API failure.

Integration testing should then confirm that changes made in one
application are reflected correctly in the other without manual
intervention.

------------------------------------------------------------------------

# 25. Deployment Strategy

Deployment should occur in four stages:

1.  Implement Provider APIs.
2.  Test APIs independently.
3.  Enable Consumer synchronisation in a test environment.
4.  Deploy to production once both applications produce identical
    results.

------------------------------------------------------------------------

# 26. Operational Governance

CADEX is a shared integration owned collaboratively by Cadence and The
Atrium.

Changes to the API contract should be agreed by both developers before
implementation.

Breaking changes should only be introduced through a new API version.

------------------------------------------------------------------------

# 27. Security

-   API keys must remain private.
-   Firestore or internal databases must never be exposed.
-   Only agreed rota information may be exchanged.
-   Failed authentication attempts should be logged.

------------------------------------------------------------------------

# 28. Success Criteria

CADEX will be considered successful when:

-   Consultant allocations automatically populate Cadence.
-   ODP and surgeon information automatically populate The Atrium.
-   Duplicate data entry is eliminated.
-   Both applications remain independent.
-   Clinical staff trust the displayed information.
-   No additional paid infrastructure is required.

------------------------------------------------------------------------

# 29. Conclusion

CADEX is not intended to replace either application.

Its purpose is to allow two independently developed systems to exchange
trusted operational information whilst preserving complete ownership of
their respective data.

By adopting a simple, secure and versioned API contract, Cadence and The
Atrium can evolve independently while presenting a unified operational
picture to the Cardiothoracic Theatre team.

The success of CADEX will not be measured by the complexity of its
implementation, but by the confidence clinicians have that the
information they see is accurate, current and consistent across both
systems.

------------------------------------------------------------------------

**End of Proposal -- Version 1.0 Draft**

------------------------------------------------------------------------
