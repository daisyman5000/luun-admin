import assert from "node:assert/strict";
import test from "node:test";
import { inquiryFromWebflow, LUUN_WEBFLOW_SITE, validInquiryToken } from "./webflow-inquiries";

const event = (data: Record<string,string> = { Name:"Test visitor", Email:"test@example.com", Message:"When will my sofa ship?", "Page URL":"https://www.luun.ca/contact", Source:"Contact page" }) => ({
  triggerType:"form_submission", payload:{ siteId:LUUN_WEBFLOW_SITE, id:"webflow-submission-1", name:"Luun Support Widget", submittedAt:"2026-10-08T18:00:00Z", data }
});

test("maps the published Webflow fields without losing the message", () => {
  const ticket = inquiryFromWebflow(event())!;
  assert.equal(ticket.customer_name,"Test visitor");
  assert.equal(ticket.customer_email,"test@example.com");
  assert.equal(ticket.status,"open");
  assert.match(ticket.details,/When will my sofa ship\?/);
  assert.match(ticket.details,/https:\/\/www.luun.ca\/contact/);
  assert.match(ticket.details,/Source: Contact page/);
});
test("retries map to the same ticket, distinct submissions do not", () => {
  const first = event(), second = event();
  second.payload.id = "different-submission";
  assert.equal(inquiryFromWebflow(first)!.id,inquiryFromWebflow(first)!.id);
  assert.notEqual(inquiryFromWebflow(first)!.id,inquiryFromWebflow(second)!.id);
});
test("rejects events from other sites and missing submission IDs", () => {
  assert.throws(() => inquiryFromWebflow({ ...event(), payload:{...event().payload,siteId:"other"} }));
  assert.throws(() => inquiryFromWebflow({ ...event(), payload:{...event().payload,id:""} }));
});
test("preserves multiline content and handles common contact fields", () => {
  const ticket=inquiryFromWebflow(event({ "First Name":"Test", "Last Name":"Buyer", "Email Address":"test@example.com", "Your Message":"Line one\nLine two" }))!;
  assert.equal(ticket.customer_name,"Test Buyer");
  assert.match(ticket.details,/Line one\nLine two/);
});
test("non-inquiry forms are ignored; invalid dates and oversized messages rejected", () => {
  assert.equal(inquiryFromWebflow(event({ Email:"test@example.com" })),null);
  assert.throws(() => inquiryFromWebflow({...event(),payload:{...event().payload,submittedAt:"bad"}}));
  assert.throws(() => inquiryFromWebflow(event({Message:"x".repeat(30001)})));
});
test("authentication fails closed, including malformed Unicode tokens", () => {
  const token="a".repeat(64);
  assert.equal(validInquiryToken(token,token),true);
  assert.equal(validInquiryToken(null,token),false);
  assert.equal(validInquiryToken(token,undefined),false);
  assert.equal(validInquiryToken("b".repeat(64),token),false);
  assert.equal(validInquiryToken("é".repeat(64),token),false);
});
