import axios from "axios";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function step(name, fn) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  let testBandId = null;
  let secondBandId = null;
  let testUserId = null;
  let originalUserName = null;
  const ts = Date.now();

  // ── Step 0: POST /api/auth/register (unauth) ──
  await step("POST /api/auth/register (unauthenticated)", async () => {
    const res = await api.post("/api/auth/register", { name: "X", email: "x@x.com" });
    assert("returns 401", res.status === 401);
  });

  // ── Step 1: login as admin ──
  await step("POST /api/auth/login (admin)", async () => {
    const res = await api.post("/api/auth/login", {
      email: "admin@rejoy.local",
      password: "admin123",
    });
    assert("returns 200", res.status === 200);
    const cookies = res.headers["set-cookie"] || [];
    const token = cookies.find(c => c.startsWith("token="));
    assert("sets token cookie", !!token);
    if (token) {
      api.defaults.headers.Cookie = token.split(";")[0];
    }
  });

  // ── Step 2: POST /api/auth/register (missing name) ──
  await step("POST /api/auth/register (missing name)", async () => {
    const res = await api.post("/api/auth/register", { email: "x@x.com" });
    assert("returns 400", res.status === 400);
  });

  // ── Step 3: POST /api/auth/register (missing email) ──
  await step("POST /api/auth/register (missing email)", async () => {
    const res = await api.post("/api/auth/register", { name: "X" });
    assert("returns 400", res.status === 400);
  });

  // ── Step 4: POST /api/auth/register (duplicate email) ──
  await step("POST /api/auth/register (duplicate email)", async () => {
    const res = await api.post("/api/auth/register", {
      name: "Dup",
      email: "admin@rejoy.local",
    });
    assert("returns 400", res.status === 400);
  });

  // ── Step 5: POST /api/bands (create test band for user registration) ──
  await step("POST /api/bands (create test band)", async () => {
    const res = await api.post("/api/bands", { name: `[TEST] Band ${ts}`, colour: "#ff0000" });
    assert("returns 201", res.status === 201);
    assert("has id", typeof res.data.id === "string");
    if (res.status === 201) {
      testBandId = res.data.id;
      assert("name matches", res.data.name === `[TEST] Band ${ts}`, `expected "[TEST] Band ${ts}", got "${res.data.name}"`);
      assert("colour matches", res.data.colour === "#ff0000", `expected "#ff0000", got "${res.data.colour}"`);
    }
  });

  // ── Step 6: POST /api/auth/register (success, default password, mustChangePassword) ──
  const testEmail = `register-test-${ts}@test.com`;
  await step("POST /api/auth/register (success)", async () => {
    if (!testBandId) {
      assert("skip — no test band", true);
      return;
    }
    const res = await api.post("/api/auth/register", {
      name: `Test User ${ts}`,
      email: testEmail,
      bandIds: [testBandId],
    });
    assert("returns 201", res.status === 201, `got ${res.status}`);
    assert("has message", typeof res.data.message === "string");
    assert("has user object", !!res.data.user);
    if (res.data && res.data.user) {
      testUserId = res.data.user.id;
      originalUserName = res.data.user.name;
      assert("user has id", typeof testUserId === "string");
      assert("email matches", res.data.user.email === testEmail, `expected ${testEmail}, got ${res.data.user.email}`);
      assert("name matches", res.data.user.name === `Test User ${ts}`);
      assert("default password flag mustChangePassword=true", res.data.user.mustChangePassword === true, `got ${res.data.user.mustChangePassword}`);
      // Verify the user appears in GET /api/users
      const getRes = await api.get("/api/users");
      const found = getRes.data.find(u => u.id === testUserId);
      assert("user visible in GET /api/users", !!found);
      if (found) {
        assert("GET shows correct name", found.name === `Test User ${ts}`);
        assert("GET shows bands array", Array.isArray(found.bands));
        assert("GET has associated band", found.bands.length >= 1);
      }
    }
  });

  // ── Step 7: login as new user with default password, then change it ──
  let userCookie = null;
  await step("login as new user (changeit) + change password", async () => {
    if (!testUserId) {
      assert("skip — no test user", true);
      return;
    }
    const loginRes = await api.post("/api/auth/login", {
      email: testEmail,
      password: "changeit",
    });
    assert("login returns 200", loginRes.status === 200, `got ${loginRes.status}`);
    assert("login flags mustChangePassword=true", loginRes.data?.user?.mustChangePassword === true);
    const cookies = loginRes.headers["set-cookie"] || [];
    const token = cookies.find(c => c.startsWith("token="));
    assert("sets token cookie", !!token);
    if (token) userCookie = token.split(";")[0];

    if (userCookie) {
      const meRes = await api.get("/api/auth/me", { headers: { Cookie: userCookie } });
      assert("GET /me returns 200 (not blocked)", meRes.status === 200, `got ${meRes.status}`);
      assert("GET /me shows mustChangePassword=true", meRes.data.mustChangePassword === true);

      const changeRes = await api.patch(
        "/api/auth/me/password",
        { currentPassword: "changeit", newPassword: "brandnew123" },
        { headers: { Cookie: userCookie } },
      );
      assert("PATCH password returns 200", changeRes.status === 200, `got ${changeRes.status}`);

      const meAfter = await api.get("/api/auth/me", { headers: { Cookie: userCookie } });
      assert("GET /me after change clears flag", meAfter.data.mustChangePassword === false, `got ${meAfter.data.mustChangePassword}`);
    }
  });

  // ── Step 8: GET /api/users ──
  await step("GET /api/users", async () => {
    const res = await api.get("/api/users");
    assert("returns 200", res.status === 200);
    assert("returns array", Array.isArray(res.data));
    if (res.data.length > 0) {
      const first = res.data[0];
      assert("has id", typeof first.id === "string");
      assert("has name", typeof first.name === "string");
      assert("has email", typeof first.email === "string");
      assert("has role", typeof first.role === "string");
      assert("has bands array", Array.isArray(first.bands));
    }
  });

  // ── Step 9: PUT /api/users (missing id) ──
  await step("PUT /api/users (missing id)", async () => {
    const res = await api.put("/api/users", { name: "X" });
    assert("returns 400", res.status === 400);
  });

  // ── Step 10: PUT /api/users (not found) ──
  await step("PUT /api/users (not found)", async () => {
    const res = await api.put("/api/users?id=00000000-0000-0000-0000-000000000000", { name: "Nobody" });
    assert("returns 404", res.status === 404);
  });

  // ── Step 11: PUT /api/users (update test user name + restore) ──
  await step("PUT /api/users (update name)", async () => {
    if (!testUserId) {
      assert("skip — no test user", true);
      return;
    }
    const newName = `Updated ${ts}`;
    const res = await api.put(`/api/users?id=${testUserId}`, { name: newName });
    assert("returns 200", res.status === 200);
    // Verify via GET
    const getRes = await api.get("/api/users");
    const user = getRes.data.find(u => u.id === testUserId);
    assert("name updated in GET", user && user.name === newName, `expected "${newName}", got "${user?.name}"`);
    // Restore
    const restoreRes = await api.put(`/api/users?id=${testUserId}`, { name: originalUserName });
    assert("restore succeeds", restoreRes.status === 200);
  });

  // ── Step 12: DELETE /api/users (missing id) ──
  await step("DELETE /api/users (missing id)", async () => {
    const res = await api.delete("/api/users");
    assert("returns 400", res.status === 400);
  });

  // ── Step 13: DELETE /api/users (not found) ──
  await step("DELETE /api/users (not found)", async () => {
    const res = await api.delete("/api/users?id=00000000-0000-0000-0000-000000000000");
    assert("returns 404", res.status === 404);
  });

  // ── Step 14: DELETE /api/users (delete test user) ──
  await step("DELETE /api/users (delete test user)", async () => {
    if (!testUserId) {
      assert("skip — no test user", true);
      return;
    }
    const res = await api.delete(`/api/users?id=${testUserId}`);
    assert("returns 200", res.status === 200);
    // Verify gone
    const getRes = await api.get("/api/users");
    assert("user removed from GET", !getRes.data.find(u => u.id === testUserId));
    testUserId = null;
  });

  // ── Step 15: POST /api/bands (missing name) ──
  await step("POST /api/bands (missing name)", async () => {
    const res = await api.post("/api/bands", { colour: "#00ff00" });
    assert("returns 400", res.status === 400);
  });

  // ── Step 16: POST /api/bands (missing colour) ──
  await step("POST /api/bands (missing colour)", async () => {
    const res = await api.post("/api/bands", { name: `[TEST] No Colour ${ts}` });
    assert("returns 201 (colour optional, defaults applied)", res.status === 201, `got ${res.status}`);
    if (res.status === 201) {
      assert("default colour applied", res.data.colour === "#4F46E5", `got ${res.data.colour}`);
      const del = await api.delete(`/api/bands?id=${res.data.id}`);
      assert("cleanup", del.status === 200);
    }
  });

  // ── Step 17: POST /api/bands (create second test band) ──
  await step("POST /api/bands (create second test band)", async () => {
    const res = await api.post("/api/bands", {
      name: `[TEST] Second Band ${ts}`,
      colour: "#00ff00",
    });
    assert("returns 201", res.status === 201);
    if (res.status === 201) {
      secondBandId = res.data.id;
      assert("has id", typeof secondBandId === "string");
      assert("name matches", res.data.name === `[TEST] Second Band ${ts}`);
      assert("colour matches", res.data.colour === "#00ff00");
    }
  });

  // ── Step 18: PUT /api/bands (missing id) ──
  await step("PUT /api/bands (missing id)", async () => {
    const res = await api.put("/api/bands", { name: "X", colour: "#fff" });
    assert("returns 400", res.status === 400);
  });

  // ── Step 19: PUT /api/bands (not found) ──
  await step("PUT /api/bands (not found)", async () => {
    const res = await api.put("/api/bands?id=00000000-0000-0000-0000-000000000000", { name: "X", colour: "#ffffff" });
    assert("returns 404", res.status === 404);
  });

  // ── Step 20: PUT /api/bands (update + restore first test band) ──
  await step("PUT /api/bands (update + restore)", async () => {
    if (!testBandId) {
      assert("skip — no test band", true);
      return;
    }
    const originalName = `[TEST] Band ${ts}`;
    const originalColour = "#ff0000";

    const res = await api.put(`/api/bands?id=${testBandId}`, {
      name: `[TEST] Band Renamed ${ts}`,
      colour: "#0000ff",
    });
    assert("returns 200", res.status === 200);
    assert("name updated", res.data.name === `[TEST] Band Renamed ${ts}`);
    assert("colour updated", res.data.colour === "#0000ff");

    // Restore
    const restoreRes = await api.put(`/api/bands?id=${testBandId}`, {
      name: originalName, colour: originalColour,
    });
    assert("restore succeeds", restoreRes.status === 200);
    assert("name restored", restoreRes.data.name === originalName);
    assert("colour restored", restoreRes.data.colour === originalColour);

    // Verify via GET
    const getRes = await api.get("/api/bands");
    const band = getRes.data.find(b => b.id === testBandId);
    assert("GET confirms name restored", band && band.name === originalName);
  });

  // ── Step 21: DELETE /api/bands (missing id) ──
  await step("DELETE /api/bands (missing id)", async () => {
    const res = await api.delete("/api/bands");
    assert("returns 400", res.status === 400);
  });

  // ── Step 22: DELETE /api/bands (not found) ──
  await step("DELETE /api/bands (not found)", async () => {
    const res = await api.delete("/api/bands?id=00000000-0000-0000-0000-000000000000");
    assert("returns 404", res.status === 404);
  });

  // ── Step 23: DELETE /api/bands (cleanup both test bands) ──
  await step("DELETE /api/bands (cleanup test bands)", async () => {
    let deleted = 0;
    for (const id of [testBandId, secondBandId].filter(Boolean)) {
      const res = await api.delete(`/api/bands?id=${id}`);
      if (res.status === 200) deleted++;
      assert(`delete band ${id}`, res.status === 200, `got ${res.status}`);
    }
    assert(`deleted ${deleted} band(s)`, deleted > 0);
    // Verify via GET
    const getRes = await api.get("/api/bands");
    if (testBandId) assert("band 1 removed", !getRes.data.find(b => b.id === testBandId));
    if (secondBandId) assert("band 2 removed", !getRes.data.find(b => b.id === secondBandId));
    testBandId = null;
    secondBandId = null;
  });

  // ── Step 24: GET /api/users (sanity) ──
  await step("GET /api/users (sanity)", async () => {
    const res = await api.get("/api/users");
    assert("returns 200", res.status === 200);
    assert("returns array", Array.isArray(res.data));
  });

  // ── Step 25: GET /api/bands (sanity) ──
  await step("GET /api/bands (sanity)", async () => {
    const res = await api.get("/api/bands");
    assert("returns 200", res.status === 200);
    assert("returns array", Array.isArray(res.data));
  });

  // ── Summary ──
  const total = passed + failed;
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${total}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
