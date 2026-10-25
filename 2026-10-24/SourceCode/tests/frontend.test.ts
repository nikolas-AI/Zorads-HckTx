import { test } from "node:test";
import assert from "node:assert/strict";
import { invitePath, parseInvite } from "../src/lib/invites";
import { compareMessageCursor, mergeMessages, sortMessages } from "../src/lib/messages";
import type { Message } from "../src/lib/types";

test("invitations round-trip encoded tokens and support legacy links", () => {
  const invite = { room: "room-1", token: "a+b/c=&" };
  assert.deepEqual(parseInvite(`https://example.com${invitePath(invite)}`), invite);
  assert.deepEqual(parseInvite("https://example.com/#room=old&invite=token"), { room: "old", token: "token" });
  for (const value of ["bad", "https://example.com/#room=one", "https://example.com/#invite=token", "javascript:alert(1)#room=x&invite=y"]) {
    assert.equal(parseInvite(value), null);
  }
});

test("message synchronization replaces duplicate IDs and keeps stable chronological order", () => {
  const message = (id: string, created_at: string, content = id): Message => ({
    id, created_at, content, room_id: "room", user_id: "user", sender_name: "User",
    agent_id: null, status: "complete", parent_id: null,
  });
  const previous = [message("b", "2026-10-25T01:00:00Z", "old")];
  const result = mergeMessages(previous, [message("a", "2026-10-25T01:00:00Z"), message("b", "2026-10-25T01:00:00Z", "updated")]);
  assert.deepEqual(result.map(m => m.id), ["a", "b"]);
  assert.equal(result[1].content, "updated");
  assert.equal(previous[0].content, "old");
});

import { validateRoomName } from "../src/lib/room-names";

test("group names accept international letters, numbers, symbols, and emoji", () => {
  for (const value of ["Weekend 123 !@#$", "साथीहरू ❤️", "朋友 🎉", "🎉".repeat(60)]) {
    assert.equal(validateRoomName(value), null);
  }
  assert.equal(validateRoomName("   "), "Enter a group name.");
  assert.equal(validateRoomName("🎉".repeat(61)), "Use 60 characters or fewer.");
});

import { validateNickname } from "../src/lib/nicknames";

test("nicknames preserve spaces and accept Unicode, numbers, symbols, and emoji", () => {
  for (const name of ["Alex Smith", "साथी 123 ✨", "!@#$", "🎉".repeat(32)]) {
    assert.equal(validateNickname(name), null);
  }
  assert.equal(validateNickname("  "), "Enter your nickname.");
  assert.equal(validateNickname("🎉".repeat(33)), "Use 32 characters or fewer for your nickname.");
});


test("tied transaction timestamps always place questions before their replies", () => {
 const make = (id: string, parent_id: string | null = null): Message => ({id, parent_id, room_id:'room', user_id:parent_id ? null : 'user', sender_name:'Name', agent_id:parent_id ? 'zorad' : null, content:id, status:'complete', created_at:'2026-10-25T01:00:00Z'});
 const question = make('z'), reply = make('a','z'), other = make('m');
 for (const input of [[reply,other,question],[question,reply,other],[other,question,reply]]) {
  assert.deepEqual(sortMessages(input).map(m=>m.id),['m','z','a']);
 }
 const pending = {...reply,status:'pending' as const};
 assert.deepEqual(mergeMessages([question,other],[pending]).map(m=>m.id),['m','z','a']);
 const completed = mergeMessages([question,pending,other],[reply]);
 assert.deepEqual(completed.map(m=>m.id),['m','z','a']);
 assert.equal(completed.at(-1)?.status,'complete');
 // The display-first message isn't necessarily the oldest database cursor.
 assert.equal([...completed].sort(compareMessageCursor)[0].id,'a');
 // A reply arriving on an earlier page is put after its question once loaded.
 assert.deepEqual(mergeMessages([reply],[question]).map(m=>m.id),['z','a']);
});
