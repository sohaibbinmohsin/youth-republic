import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyVolunteerAuthUser, verifyVolunteerToken } from "./verifyVolunteerAuth.ts";

function fakeSupabase(options: { user?: { id: string } | null; volunteer?: { id: string } | null }) {
  return {
    auth: {
      async getUser(_token: string) {
        return options.user
          ? { data: { user: options.user }, error: null }
          : { data: { user: null }, error: new Error("invalid token") };
      },
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return {
                async single() {
                  return options.volunteer
                    ? { data: options.volunteer, error: null }
                    : { data: null, error: new Error("not found") };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("verifyVolunteerAuthUser returns the auth user id for a valid token", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" } });
  const result = await verifyVolunteerAuthUser(supabase as never, "Bearer good-token");
  assertEquals(result.authUserId, "user-1");
});

Deno.test("verifyVolunteerAuthUser rejects a missing header", async () => {
  const supabase = fakeSupabase({ user: null });
  await assertRejects(() => verifyVolunteerAuthUser(supabase as never, null), Error, "unauthorized");
});

Deno.test("verifyVolunteerToken resolves the volunteer row for the authenticated user", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" }, volunteer: { id: "vol-1" } });
  const result = await verifyVolunteerToken(supabase as never, "Bearer good-token");
  assertEquals(result.volunteerId, "vol-1");
  assertEquals(result.authUserId, "user-1");
});

Deno.test("verifyVolunteerToken rejects when no volunteer row exists yet for this auth user", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" }, volunteer: null });
  await assertRejects(() => verifyVolunteerToken(supabase as never, "Bearer good-token"), Error, "unauthorized");
});
