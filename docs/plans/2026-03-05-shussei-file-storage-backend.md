# Shussei File Storage Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add channel-scoped, persistent file storage to `shussei-api`, with PostgreSQL metadata, local streamed I/O, secure folder/file APIs, range downloads, chat attachment references, and physical-file cleanup.

**Architecture:** Files belong to a channel and are authored by a user. PostgreSQL stores the virtual hierarchy and metadata; a dedicated storage service stores binary content under UUID-derived paths. Uploads use a temporary file and an explicit metadata lifecycle so database failures cannot silently leave permanent files. Existing ephemeral Redis chat messages reference durable files by ID but never carry binary data.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma 5, PostgreSQL, Express streams/multipart handling, Redis, Socket.IO, Jest, Supertest

**Spec:** Reviewed storage-module requirements from the Shussei file-system plan; the decisions and invariants in this document are authoritative for implementation.

## Global Constraints

- Files and folders are scoped to a `Channel`; `createdByUserId` records authorship.
- Files persist independently of ephemeral Redis chat-message retention.
- Existing `User`, `Channel`, and other application IDs remain compatible; storage IDs use PostgreSQL UUIDs where supported.
- The physical path is derived only from the file UUID; user-provided names never enter a filesystem path.
- Upload and download operations are streamed; binary contents must not be loaded entirely into memory.
- Every protected endpoint uses the existing session guard and channel authorization.
- The MVP does not generate thumbnails; image previews use the original file URL.
- The MVP uses a configurable local `ROOT_STORAGE_PATH`; object storage is out of scope.
- Failed physical deletion is retryable and observable; it must not be silently ignored.
- File size and MIME policy are enforced by the backend, not only by clients.

## Data Model and Invariants

`Folder` represents a virtual folder. `parentId = null` means the channel root. A folder parent must belong to the same channel. Two folders with the same name cannot exist under the same parent in the same channel.

`StoredFile` represents one binary. `folderId = null` means the channel root. The file's `channelId` must match its folder's channel. `status` is `pending | ready | deleting | failed`; only `ready` files are downloadable.

A file attachment in an ephemeral message contains only safe metadata and a file ID. The server resolves and validates IDs when producing the message; clients cannot inject arbitrary download URLs.

## Planned File Structure

- `prisma/schema.prisma` — add `Folder` and `StoredFile` models and relations.
- `prisma/migrations/<timestamp>_add_file_storage/migration.sql` — schema, indexes, constraints, and any SQL unsupported by Prisma schema syntax.
- `src/config/env.ts` or the existing configuration location — storage root, upload limit, and allowed MIME configuration.
- `src/storage/storage.module.ts` — expose physical storage service.
- `src/storage/storage-path.service.ts` — deterministic UUID-to-path resolution.
- `src/storage/storage.service.ts` — streamed write, move, read, stat, delete, and checksum primitives.
- `src/storage/storage.service.spec.ts` — path, stream, cleanup, and failure tests.
- `src/files/files.module.ts` — file/folder module wiring.
- `src/files/files.controller.ts` — folder and file HTTP endpoints.
- `src/files/files.service.ts` — metadata orchestration and upload/delete workflows.
- `src/files/files-access.service.ts` — channel authorization and parent/child validation.
- `src/files/dto/*.ts` — create-folder, rename, move, and attachment DTOs.
- `src/files/files.service.spec.ts` — metadata and workflow tests.
- `src/files/files.controller.spec.ts` — HTTP, headers, and guard behavior tests.
- `src/chat/chat.service.ts` — validate file IDs and serialize attachment metadata.
- `src/presence/presence.gateway.ts` — accept `fileIds` in `chat.send` while preserving text-only messages.
- `src/cleanup/file-cleanup.service.ts` — retryable physical deletion and reconciliation job, or the project’s equivalent job module.
- `test/app.e2e-spec.ts` — protected endpoint and streaming smoke coverage.
- `.env.example` — document storage configuration.

## REST Contract

```text
GET    /api/v1/channels/:channelId/folders?parentId=<uuid|null>
POST   /api/v1/channels/:channelId/folders
GET    /api/v1/folders/:folderId
GET    /api/v1/folders/:folderId/breadcrumbs
PATCH  /api/v1/folders/:folderId
DELETE /api/v1/folders/:folderId

GET    /api/v1/channels/:channelId/files?folderId=<uuid|null>
POST   /api/v1/channels/:channelId/files        multipart/form-data
GET    /api/v1/files/:fileId
HEAD   /api/v1/files/:fileId
PATCH  /api/v1/files/:fileId
DELETE /api/v1/files/:fileId
```

`GET /folders/:id` returns the folder, immediate child folders, and immediate files. `GET /files/:id` supports full streaming (`200`) and valid byte ranges (`206`), returning `416` for an unsatisfiable range. Access failures are `401/403`; missing records are `404`.

A chat send payload becomes:

```ts
{ channelId: string; body: string; fileIds?: string[] }
```

The response attachment shape is:

```ts
{
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
}
```

## Tasks

### Task 1: Add schema, migration, and storage configuration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_file_storage/migration.sql`
- Modify: `.env.example`
- Modify: existing environment validation/config file
- Test: Prisma migration validation and generated client

- [ ] Add `Folder` and `StoredFile` models with UUID storage IDs, channel/user relations, nullable root parent/folder, timestamps, status, and indexes.
- [ ] Add a migration that enforces same-level folder-name uniqueness, including the root case where `parent_id IS NULL`; use explicit SQL if Prisma cannot express `NULLS NOT DISTINCT`.
- [ ] Add a same-channel integrity strategy for folder parents and file folders. If a database composite constraint is impractical with the existing schema, enforce it in the service and cover it with integration tests.
- [ ] Add `STORAGE_ROOT_PATH`, `MAX_FILE_SIZE_BYTES`, and an explicit allowed-MIME configuration with safe local defaults.
- [ ] Run `npx prisma validate`, `npx prisma generate`, and the migration against a disposable PostgreSQL database.
- [ ] Commit: `feat(api): add file storage schema`

### Task 2: Implement deterministic streamed physical storage

**Files:**
- Create: `src/storage/storage-path.service.ts`
- Create: `src/storage/storage.service.ts`
- Create: `src/storage/storage.module.ts`
- Create: `src/storage/storage.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- `StoragePathService.pathFor(fileId: string): string`
- `StorageService.writeTemp(input: Readable, fileId: string): Promise<{ tempPath: string; sizeBytes: bigint; checksum: string }>`
- `StorageService.promote(tempPath: string, fileId: string): Promise<string>`
- `StorageService.openRead(fileId: string, options?: { start?: number; end?: number }): Readable`
- `StorageService.stat(fileId: string): Promise<{ sizeBytes: number; modifiedAt: Date }>`
- `StorageService.remove(fileId: string): Promise<void>`

- [ ] Resolve UUID paths as `<root>/<first-two>/<next-two>/<uuid>.bin`, after validating canonical UUID syntax.
- [ ] Create parent directories recursively before promotion.
- [ ] Write streams to a uniquely named temporary file under the storage root; calculate byte count and SHA-256 while piping.
- [ ] Promote with an atomic rename when possible and never overwrite another file ID.
- [ ] Open bounded read streams for ranges without buffering the file.
- [ ] Make deletion idempotent for an already absent physical file.
- [ ] Test traversal-like IDs, invalid IDs, directory creation, byte counts, checksums, range reads, interrupted writes, and cleanup.
- [ ] Commit: `feat(api): add streamed local storage service`

### Task 3: Implement folder metadata and authorization

**Files:**
- Create: `src/files/files.module.ts`
- Create: `src/files/files.service.ts`
- Create: `src/files/files-access.service.ts`
- Create: `src/files/dto/create-folder.dto.ts`
- Create: `src/files/dto/update-folder.dto.ts`
- Create: `src/files/files.service.spec.ts`
- Create: `src/files/files.controller.ts`
- Create: `src/files/files.controller.spec.ts`
- Modify: `src/app.module.ts`

- [ ] Add channel-scoped listing and folder creation with DTO validation and authenticated `createdByUserId`.
- [ ] Validate that a referenced parent belongs to the requested channel.
- [ ] Translate unique-constraint races into `409 Conflict`; do not rely only on a preflight query.
- [ ] Implement folder detail with immediate children/files and breadcrumbs using a recursive SQL query or equivalent bounded traversal.
- [ ] Implement rename, move, and recursive deletion; reject moving a folder into itself or one of its descendants.
- [ ] Apply `JwtSessionGuard` and channel access checks to every route.
- [ ] Test root and nested folders, duplicate names under concurrency, cross-channel IDs, breadcrumbs, cycles, and unauthorized access.
- [ ] Commit: `feat(api): add channel file folders`

### Task 4: Implement streamed upload and metadata lifecycle

**Files:**
- Modify: `src/files/files.controller.ts`
- Modify: `src/files/files.service.ts`
- Create/Modify: `src/files/dto/*.ts`
- Modify: `.env.example`
- Test: `src/files/files.service.spec.ts`, `src/files/files.controller.spec.ts`

- [ ] Receive multipart input as a stream and reject missing files, excessive declared size, and oversized streams.
- [ ] Store to a temporary path, detect/validate MIME according to the configured policy, calculate size/checksum, and create `pending` metadata.
- [ ] Promote the binary, then mark metadata `ready`; if any later step fails, remove the temporary/final physical file and mark or remove metadata deterministically.
- [ ] Sanitize only the display name; preserve the original name as metadata and never use it in the physical path.
- [ ] Return a stable `StoredFile` DTO with a relative API download URL.
- [ ] Test successful upload, stream limit enforcement, MIME rejection, duplicate names, DB failure cleanup, and interrupted upload cleanup.
- [ ] Commit: `feat(api): add streamed file uploads`

### Task 5: Implement range download, HEAD, and file mutations

**Files:**
- Modify: `src/files/files.controller.ts`
- Modify: `src/files/files.service.ts`
- Modify: `src/storage/storage.service.ts`
- Test: `src/files/files.controller.spec.ts`

- [ ] Parse a single `Range: bytes=start-end` request, clamp an open-ended end to the file size, and reject malformed/multiple/unsatisfiable ranges with `416` and `Content-Range: bytes */<size>`.
- [ ] Return `200` for full content and `206` for a valid range.
- [ ] Set `Content-Type`, `Content-Length`, `Accept-Ranges: bytes`, `Content-Range` when partial, `ETag`, `Last-Modified`, and safe `Content-Disposition`.
- [ ] Implement `HEAD` with identical headers and no body.
- [ ] Return `404` for missing metadata/physical content and avoid exposing filesystem paths.
- [ ] Implement rename, move, and explicit file deletion with authorization.
- [ ] Test complete and partial reads, zero-length files, invalid ranges, HEAD, inline image disposition, download names, and deleted files.
- [ ] Commit: `feat(api): add ranged file downloads`

### Task 6: Integrate durable attachments into ephemeral chat

**Files:**
- Modify: `src/chat/chat.service.ts`
- Modify: `src/presence/presence.gateway.ts`
- Modify: `src/chat/chat.service.spec.ts`
- Modify: `src/presence/presence.gateway.spec.ts`
- Modify: the shared DTO/type location used by API responses

- [ ] Accept optional `fileIds` and validate every ID belongs to the message channel, is `ready`, and is visible to the sender.
- [ ] Serialize attachment metadata from the database; ignore client-supplied URLs and names.
- [ ] Preserve text-only messages and reject empty messages with no attachments.
- [ ] Keep attachments durable when the Redis message expires; deleting the file removes future access but does not require rewriting old Redis payloads.
- [ ] Test valid attachments, cross-channel rejection, pending/failed files, duplicate IDs, and text-only compatibility.
- [ ] Commit: `feat(api): support file attachments in chat`

### Task 7: Add cleanup jobs and reconciliation

**Files:**
- Create: `src/cleanup/file-cleanup.service.ts`
- Create: `src/cleanup/file-cleanup.service.spec.ts`
- Modify: `src/files/files.service.ts`
- Modify: `src/app.module.ts`
- Modify: `.env.example`

- [ ] Before recursive deletion, collect file IDs in the database transaction and transition them to `deleting`.
- [ ] Delete metadata transactionally, then enqueue or execute idempotent physical deletion with retry state.
- [ ] Remove stale temporary files and mark stale `pending` rows `failed`.
- [ ] Add a periodic reconciliation routine that reports/removes physical files with no `ready` metadata according to a conservative grace period.
- [ ] Make jobs safe to run more than once and ensure failures are logged with file IDs, not secrets.
- [ ] Test recursive deletion, retry, missing binaries, orphan detection, and idempotency.
- [ ] Commit: `feat(api): add file cleanup jobs`

### Task 8: Complete API integration and regression verification

**Files:**
- Modify: `test/app.e2e-spec.ts`
- Modify: API documentation/contract files if present
- Modify: `.env.example`

- [ ] Add authenticated e2e coverage for folders, upload, full download, range download, HEAD, deletion, and attachment send.
- [ ] Verify existing auth, channels, chat, presence, and RTC tests still pass.
- [ ] Run `npm test -- --runInBand`, `npm run test:e2e`, `npm run build`, and `npx prisma validate`.
- [ ] Confirm no `dist/`, storage contents, temporary files, or local environment files are staged.
- [ ] Commit: `test(api): verify file storage integration`

## Acceptance Criteria

- Two users in the same channel can create/list folders and upload files without sharing filesystem paths.
- A user from another channel cannot enumerate, download, move, rename, or delete the file.
- Uploads and downloads remain bounded-memory streams.
- Valid ranges produce correct `206` headers and bytes; invalid ranges produce `416`.
- A folder deletion removes descendant metadata and eventually removes all descendant binaries.
- A failed upload or metadata operation leaves no permanent untracked binary after cleanup.
- Chat messages can reference uploaded files without placing binary data in Redis or Socket.IO.
- Existing Shussei behavior and tests remain intact.
