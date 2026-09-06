import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseTwilioInbound, verifyTwilioSignature } from "./webhook";

describe("parseTwilioInbound", () => {
  it("lê mensagem inbound com telefone", () => {
    const raw = new URLSearchParams({
      MessageSid: "SMabc",
      From: "whatsapp:+5561999999999",
      To: "whatsapp:+16472547342",
      Body: "oi",
      ProfileName: "Ana",
    }).toString();
    const m = parseTwilioInbound(raw);
    expect(m).toMatchObject({
      kind: "message",
      direction: "inbound",
      externalId: "SMabc",
      text: "oi",
      fromDigits: "5561999999999",
      profileName: "Ana",
    });
  });

  it("lê desfecho delivered sem corpo", () => {
    const raw = new URLSearchParams({
      MessageSid: "SMabc",
      MessageStatus: "delivered",
    }).toString();
    const m = parseTwilioInbound(raw);
    expect(m).toMatchObject({ kind: "status", status: "delivered", externalId: "SMabc" });
  });

  it("ignora payload sem sid", () => {
    expect(parseTwilioInbound("Body=oi")).toBeNull();
  });
});

describe("verifyTwilioSignature", () => {
  it("recusa sem token, header ou url", () => {
    expect(verifyTwilioSignature("a=1", "x", "", "https://x")).toBe(false);
    expect(verifyTwilioSignature("a=1", null, "tok", "https://x")).toBe(false);
    expect(verifyTwilioSignature("a=1", "x", "tok", "")).toBe(false);
  });

  it("aceita HMAC-SHA1 do URL + params ordenados", () => {
    const token = "auth-token-de-teste";
    const url = "https://crm.example/api/v1/webhooks/channel/abc";
    const raw = "Body=oi&From=whatsapp%3A%2B5561";
    const params = new URLSearchParams(raw);
    const data = [...params.keys()]
      .sort()
      .reduce((acc, key) => acc + key + (params.get(key) ?? ""), url);
    const sig = createHmac("sha1", token).update(data, "utf8").digest("base64");
    expect(verifyTwilioSignature(raw, sig, token, url)).toBe(true);
    expect(verifyTwilioSignature(raw, sig, "outro", url)).toBe(false);
  });
});
