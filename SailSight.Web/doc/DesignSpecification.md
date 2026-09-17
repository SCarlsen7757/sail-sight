# SailSight frontend reference

This guide describes the implemented web application. Future capabilities belong in [GitHub feature issues](https://github.com/SCarlsen7757/sail-sight/issues?q=is%3Aissue%20is%3Aopen%20label%3Afeature). The earlier design specification mixed intended behavior with implemented behavior; consult Git history for that original design.

## Application and API

SailSight analyzes uploaded VKX 1.4 recordings after sailing. The API validates and ingests recordings using the external `Vakaros.Vkx.Parser.NET` package, detects timer-defined races, and serves telemetry and analysis. The frontend uses Next.js 16, React 19, Leaflet, and ECharts; dependency manifests are authoritative for exact versions.

Browser requests use the same-origin `/api/*` proxy. The typed `api` client and `browserRequest` helper attach CSRF headers and follow collection continuations. Server-side API calls use `API_BASE_URL`. Endpoint contracts live in the [generated OpenAPI document](../../SailSight.Api/OpenApi/SailSight.Api.json); the API exposes `/openapi/v1.json` and `/scalar` in development. Do not maintain a separate handwritten list of DTO fields here.

MultiUser is the default: accounts use email/password and cookie authentication. Admins create accounts with setup links or shareable registration invitations. There is no unrestricted signup, self-service password reset, email verification, PAT authentication, or social login. SingleUser uses a synthetic system user and requires the explicit localhost profile and a compatible database. See the [security/deployment guide](../../docs/security/implementation.md) for access rules and configuration.

## Layout and navigation

Both the public and authenticated shells keep navigation visible, including on viewer pages:

| Width | Navigation |
| --- | --- |
| Below 1024 px | Bottom tabs; when more than six items are visible, show five plus a More menu |
| 1024–1279 px | Icon rail with tooltips |
| 1280 px and above | Collapsible sidebar |

Home, Sessions, and Fleet are available to anonymous visitors. Upload, Courses, Teams, Account, and Settings require authentication. Admin and Class requests require the Admin role. Anonymous visitors see Sign in; Fleet links to boat classes and Courses links to marks. The SingleUser banner appears in both app shells.

Team-invitation and admin class-request badges use `/api/v1/me/notifications/stream`. The stream retries after 30 seconds on error and reconnects on focus when closed. Protected pages redirect anonymous visitors to `/sessions`; unauthorized admin-page visitors are redirected to `/`.

Loading and error presentation is page-specific: shared skeletons, text loading indicators, error banners, inline messages, and toasts are all used. Forms generally use explicit Save/Cancel controls; there is no application-wide unsaved-change guard. Sorting, filters, and pagination are implemented per page, not guaranteed on every table. Deletions use shared confirmation dialogs or browser confirmation prompts.

Toasts appear at the top right in insertion order. Non-sticky success/info/warning toasts dismiss after four seconds. Errors and explicitly sticky toasts stay until dismissed. See the [color reference](ColourScheme.md) for theme tokens.

## Pages and ownership

### Accounts and administration

- `/login`: email/password form; successful login follows `?next=` or opens `/`.
- `/setup?userId=X&token=Y`: validates a one-time setup link, collects a password and confirmation, then signs in. Passwords require at least 12 characters.
- `/invite?token=X`: validates an admin-issued invitation, collects email, display name, password, and confirmation, then signs in. Invitation use/expiry limits are enforced by the API.
- `/account`: edit display name, view email/roles, change password, and sign out. Password feedback is inline. Logout revokes the current login session; security-stamp changes can revoke all devices.
- `/admin/users`: create users/setup links, change roles, delete eligible users, and create/revoke registration invitations with role, use limit, expiry, and note. The API rejects deletion of accounts owning sailing data or a team's sole owner; the UI confirmation is not the authority for deletion semantics.
- `/admin/boat-classes`: approve or reject boat-class requests and view reviewed requests.

### Home and sessions

`/` shows platform statistics and, for signed-in users, personal statistics. Statistics are subject to the API's visibility rules.

`/upload` accepts one `.vkx` file via drag/drop or a file picker, checks the extension and **200,000,000-byte** limit, then uploads automatically to `POST /api/v1/sessions`. A spinner indicates progress. Success opens the session detail page; invalid files, duplicates, and other failures produce feedback. The API additionally validates VKX version/structure and enforces admission and rate limits.

`/sessions` lists accessible sessions with text search and pagination. Signed-in users switch between My Sessions, Team Sessions, and Public tabs; these select one visibility category at a time. The page does not expose date/boat filters or sortable column controls. Public session projections use a display title and hide the original filename, hash, and notes from visitors without private access.

`/sessions/{id}` shows metadata and detected races. Owners edit display name, boat, notes, visibility, and each race's course through Edit session; they can also manage team shares and delete the session. Team sharing grants read access. Race detection has no manual split/merge controls.

`/s/{id}`, `/r/{id}`, and `/b/{id}` provide public session, race, and boat views. They remain subject to API visibility checks. Public and authenticated race pages use the same replay component.

### Boats, marks, and courses

`/boats` browses boats and provides owner management; `/boats/{id}` contains owner detail/editing and statistics. Boats have name, sail number, boat class, description, and public visibility. Deleting a boat unlinks associated sessions rather than deleting their recordings.

`/boat-classes` exposes the class catalog. Admins create/edit/delete classes; signed-in non-admin users can submit requests and inspect their outcomes. The API blocks deletion of a class referenced by boats.

`/marks` manages owned marks with coordinates, active dates, descriptions, and default rounding radii, using an edit panel. Referenced marks cannot be deleted while course legs use them.

`/courses` manages owned courses and ordered legs. The edit panel supports rounding marks with passing side/radius overrides and gates with two distinct endpoints, plus leg reordering. The API validates ownership of referenced marks. Deleting a course removes its race assignments and recalculates affected analysis; it is not blocked simply because races use it.

Race analysis uses the course explicitly assigned to each race. A session-level course is not inherited. See [recorded race analysis](../../docs/analysis/recorded-races.md) for geometry, outcomes, invalidation, and upgrade behavior.

### Teams and settings

`/teams` lists memberships and pending invitations and provides team creation and invitation acceptance/decline. `/teams/{id}` lists members and shared sessions; team managers can invite an existing account by email and view pending invitations. Member removal is authorized by the API, including role and final-owner protections; button visibility is not an authorization guarantee.

`/settings` stores display preferences locally under `sailsight.units`, with storage-event synchronization across hooks/tabs and a reset action:

| Preference | Options | Default |
| --- | --- | --- |
| Boat speed | Knots, km/h, mph | Knots |
| Wind speed | Knots, m/s, km/h | Knots |
| Course length | Nautical miles, km, miles, metres | Nautical miles |

Conversions happen in the frontend. Telemetry speeds and distances use m/s and metres; COG/wind/shift directions use radians, geographic coordinates use degrees, and temperature uses °C. Derived fields can explicitly use other units, such as `approachCourseDegrees`.

## Recorded race viewer

`/races/{id}` and `/r/{id}` show playback controls and a map on the left with analysis/instruments/charts on the right at desktop widths; mobile stacks the content. Header buttons toggle gauges and charts independently. Hiding charts expands the map and makes the instrument panel compact. Defaults are charts visible and gauges hidden.

### Playback and map

- The scrubber advances the map marker, digital instruments, and chart playback lines. The signed timer shows countdown before the race start and elapsed time afterward.
- Speed choices are 0.5×, 1×, 2×, 4×, 8×, 16×, and 32×. Playback stops at the selected window's end; it does not loop automatically.
- The time-window slicer changes chart bounds and highlights the selected track segment with an orange overlay. It does not refetch telemetry. Hover tooltips are chart-local; clicking/hovering charts does not seek playback or synchronize all hover crosshairs.
- Viewer state is shared in an in-memory Zustand store, not persisted in localStorage or the URL. Some state can survive client-side navigation; the duration/window are initialized for the loaded recording.
- The map supports Flat/Heatmap tracks, zoom, Fit track, Follow boat, and an OpenSeaMap checkbox. Dragging cancels follow; the follow button re-enables it. Follow pans when the marker approaches the viewport edge.
- Recorded countdown tracks are dashed purple. Start-line endpoints use a cyan triangle and orange square. Course overlays show mark radii, gate segments, and the active target; they do not draw a complete mark-to-mark course polyline.
- The playback arrow follows COG. The map fits the race track on load. Narrowing the time window adds an overlay without dimming the rest of the track.

CARTO provides theme-dependent basemaps. The key comes from the `CARTO_API_KEY` runtime environment variable via `/api/config`; deployments without one render a provider watermark, tracked in [issue #26](https://github.com/SCarlsen7757/sail-sight/issues/26). The UI offers OpenSeaMap, but the current CSP omits its tile host, so that overlay can be blocked. Documentation screenshots use stub tiles and do not validate either external service.

### Instruments and charts

The shared digital instrument panel displays SOG with COG, separate boat heading derived from the orientation quaternion, and signed heel/trim with supporting scales (±45° and ±10°). Heading and COG are distinct measurements. Instruments use the latest normalized sample at or before the playback cursor (clamped to available endpoints); the map position/COG and target-VMG readout interpolate separately. Invalid readings use a dash. Additional sensor instruments are tracked in [issue #35](https://github.com/SCarlsen7757/sail-sight/issues/35).

Race charts display SOG, COG with an optional dashed heading trace, and heel/trim. Wind speed/direction, speed through water, depth, temperature, load, and shift-record true heading are shown only when their arrays contain data. Angular COG/heading plots break lines at north crossings. Chart X axes use timestamps, with a playback marker driven by the scrubber.

GPS paths use zoom-dependent Ramer–Douglas–Peucker simplification in `src/lib/track-utils.ts`. ECharts uses average sampling for non-angular series; there is no universal 2,000-point chart cap. Telemetry is paginated by the API and assembled by the request helper.

`normalization.ts` uses order-2 Savitzky–Golay smoothing with odd windows derived from telemetry rate: approximately 1.5 seconds for SOG/COG, 5 seconds for quaternions, and 3 seconds for wind (minimum five samples). Short series retain raw values. Angular smoothing uses sin/cos; quaternion smoothing normalizes and keeps signs consistent. Missing-data handling is channel-specific, not a universal forward-fill promise. Invalid orientations and course-leg VMG gaps remain unavailable.

Race metadata loads first, then position and course requests run in parallel. The main viewer waits for race/position data; chart telemetry and leg results load separately. The optional chart panel currently has no dedicated fetch-error display.

### Start and leg analysis

Start analysis is hidden when absent. It shows time bias, crossing speed, approach course, position on the line in metres, line length, crossing time, and OCS/cleared indicators where available. It makes a separate request for start-line length. There is no dedicated start-crossing point marker on the map.

Leg summaries display backend outcomes and unsmoothed time-weighted metrics. Selecting a leg pauses playback and seeks its approach start. Valid approaches highlight their target and provide a separate VMG-to-target readout/chart; gates use their midpoint. Countdown, rounding, unresolved legs, and missing samples have no target VMG. The [analysis guide](../../docs/analysis/recorded-races.md) is authoritative for calculation details.

### Session viewer limitation

`/sessions/{id}/viewer` currently fetches positions and charts from the session's **first race only**, while using session start/end times for playback bounds. Sessions without races show no telemetry there. It has no race start/leg analysis or course overlays. It must not be described as a full continuous-session viewer until its data source is changed.

## Verification and future work

Behavior is covered by the API tests and Playwright specs under `e2e/specs`; [AGENTS.md](../../AGENTS.md) lists commands. Screenshot regeneration is described in [the screenshot guide](../../docs/screenshots/README.md). Documentation changes alone do not require regenerating images.

AI reports, PATs, external identity, and other deferred features are tracked in GitHub, linked from the [security guide](../../docs/security/implementation.md#follow-up-work). Historical security test/scan results are dated evidence, not a statement that the current checkout has been retested.
