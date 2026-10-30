# Service drafts: private sandbox and before/after preview

An admin can change a service guide without touching the public directory. The edit is saved as a
**draft**, compared field by field with the published guide, previewed with the public service page, and
published as a separate, confirmed step.

Admin tab: **Drafts**. In the guide editor, **Save as draft** is the primary button; **Publish now** is the
old direct save, kept for quick fixes.

## What a draft is

| Part | Meaning |
|---|---|
| `record` | The full guide as the editor produced it |
| `base` | A snapshot of the published guide when the draft began (`null` for a new guide) |
| `serviceId` | The guide being edited, or `null` for a new guide |

Drafts live under `civicbridge_service_drafts_v1` in the browser's localStorage. They are **private to
that browser**, not shared between admins, and are admin data that "Clear my data" keeps (see
`DATA_RETENTION.md`). All draft functions need the `services.write` permission.

Nothing in `serviceDrafts.js` writes to `civicbridge_custom_services` except `publishDraft`, so saving,
editing, previewing and discarding a draft never change what citizens see.

## Flow

1. **Edit** a guide, then **Save as draft**. Editing the same guide again opens its draft.
2. **Drafts tab, Review** shows:
   - **Problems** that block publishing, each a link that opens the editor with the cursor in that field.
   - **Before and after**: a table with the field, the kind of change (Added, Removed, Changed, written out
     and not only coloured), the published value and the draft value. List fields show the items added and removed.
   - **Preview**: the real `ServiceDetails` page rendered with `previewService`. Links and buttons are switched off,
     so a preview never saves, shares or applies for anything. Optional fields that are missing are simply not shown.
3. **Publish…** shows what will change and asks for confirmation. Publishing goes through `saveAdminService`
   (permission check, audit trail) and adds a `SERVICE_DRAFT_PUBLISHED` entry listing the changed fields.
4. **Discard** deletes only the draft. The published guide was never changed, so there is nothing to undo.

## Rules for publishing

A draft is published only when all of these hold:

- Required fields are present: name, plain language summary, category, mode, difficulty, fees, processing time,
  official portal name and an **https** address, and at least one required document. Jurisdiction, when set, must be valid.
- A new guide's link (made from its name) does not clash with an existing guide.
- The draft changes at least one field.
- If the published guide **changed after the draft began** (someone else published, or another tab), the review
  lists those newer changes and publishing needs an explicit tick to overwrite them.
- If the guide was removed after the draft began, the draft is kept and cannot be published.

A failed write keeps the draft and says why.

## Limits

- Storage is localStorage, like the rest of the catalogue: this is not a shared workflow between admins and not
  tamper-proof (see `ACCESS_CONTROL.md`). At most 50 drafts.
- The editor does not yet edit the steps or the eligibility text; they are carried over unchanged and shown in
  the comparison if they differ.
- Two-person approval is a separate issue (#261) and builds on this draft state.
