import { describe, expect, it } from "vitest";
import { addManualRedaction, applyRedactions, countByKind, detectRedactions, findLeaks, restoreText, withHits } from "./redact";
import { SAMPLES } from "./samples";
import { scan } from "./scanner";

const sentFor = (text: string) => { const items = detectRedactions(text); return { items, ...applyRedactions(text, items) }; };
const kinds = (text: string) => detectRedactions(text).map((i) => `${i.placeholder}=${i.value}`);

describe("redaction: patterns", () => {
  it.each([
    ["UK mobile", "Call me on 07700 900123 after 5pm.", "07700 900123"],
    ["UK mobile without spaces", "Mobile: 07700900123", "07700900123"],
    ["UK landline (Durham/Tyneside)", "Office tel 0191 498 0123.", "0191 498 0123"],
    ["UK landline (London)", "Tel: 020 7946 0321", "020 7946 0321"],
    ["UK landline with brackets", "Phone (01632) 960123", "(01632) 960123"],
    ["+44 mobile", "Tel: +44 7700 900456", "+44 7700 900456"],
    ["+44 with (0)", "Contact +44 (0)191 498 0999 in office hours", "+44 (0)191 498 0999"],
    ["international", "Parent: +91 98765 43210", "+91 98765 43210"],
  ])("redacts a %s number", (_name, text, phone) => {
    const { redacted, items } = sentFor(text);
    expect(items.map((i) => i.value)).toEqual([phone]);
    expect(redacted).toContain("[PHONE_1]");
    expect(redacted).not.toContain(phone);
  });

  it("redacts emails and reuses one placeholder for the same address", () => {
    const { redacted } = sentFor("Email priya.sharma@example.com or Tom.Okafor@example.co.uk. Again: priya.sharma@example.com");
    expect(redacted).toBe("Email [EMAIL_1] or [EMAIL_2]. Again: [EMAIL_1]");
  });

  it("redacts full postcodes, alone and inside an address", () => {
    expect(sentFor("Send post to LS6 2AB please.").redacted).toBe("Send post to [POSTCODE_1] please.");
    expect(sentFor("Home address: 27 Elm Grove, Leeds LS6 2AB").redacted).toBe("Home address: [ADDRESS_1]");
  });

  it("redacts NI numbers, sort codes, account numbers, dates of birth and ID numbers", () => {
    const { redacted } = sentFor("NI AB 12 34 56 C. Sort code 12-34-56, account number 12345678. Date of birth: 14/02/2005. Passport no: 123456789. Student ID: 000912345.");
    expect(redacted).toBe("NI [NI_1]. Sort code [BANK_1], account number [BANK_2]. Date of birth: [DOB_1]. Passport no: [ID_1]. Student ID: [STUDENT_ID_1].");
  });

  it("replaces a name in full and when only the first name is used", () => {
    const { redacted, items } = sentFor("Tenant: Priya Sharma\n1.2 Priya Sharma is the lead tenant and notices given to Priya bind all tenants. PRIYA SHARMA signs below.");
    expect(items.map((i) => i.placeholder)).toEqual(["[TENANT_1]"]);
    expect(redacted).toBe("Tenant: [TENANT_1]\n1.2 [TENANT_1] is the lead tenant and notices given to [TENANT_1] bind all tenants. [TENANT_1] signs below.");
  });

  it("reads names from the parties sentence, labels and signature blocks", () => {
    const text = `THIS AGREEMENT is made between Mr John Whitfield of 4 Orchard Lane, York YO1 7HH (the "Landlord") and Aisha Khan and Ben Carter (the "Tenants").
Guarantor: Farah Khan
Signed by the Witness: Olu Adeyemi`;
    expect(kinds(text)).toEqual(expect.arrayContaining(["[LANDLORD_1]=John Whitfield", "[TENANT_1]=Aisha Khan", "[TENANT_2]=Ben Carter", "[GUARANTOR_1]=Farah Khan", "[WITNESS_1]=Olu Adeyemi", "[ADDRESS_1]=4 Orchard Lane, York YO1 7HH"]));
    expect(sentFor(text).redacted).not.toMatch(/Whitfield|Aisha|Carter|Farah|Adeyemi|Orchard/);
  });

  it("keeps money, dates, terms, clause numbers and company names", () => {
    const text = `Landlord: Wearside Student Lets Ltd
2.1 The rent is £168 per person per week, £2,184.00 per term, payable from 1 July 2027 to 30/06/2028.
4.1 A deposit of £840 is payable. Notice period: 2 months. Term: 12 months. Late interest 3% after 14 days.
16.3 A late payment charge of £50 will be applied. Call 0 times. Ref 2027-28.`;
    const { redacted, items } = sentFor(text);
    expect(items).toEqual([]);
    expect(redacted).toBe(text);
  });

  it("keeps the town and postcode district of the rented property", () => {
    const { redacted, items } = sentFor("ASSURED SHORTHOLD TENANCY AGREEMENT — 14 Gilesgate, Durham DH1 1HP\n1.1 The Tenant shall occupy 14 Gilesgate as their only home. Post for DH1 1HP is collected weekly.");
    expect(items.map((i) => i.placeholder)).toEqual(["[PROPERTY_ADDRESS]"]);
    expect(redacted).toBe("ASSURED SHORTHOLD TENANCY AGREEMENT — [PROPERTY_ADDRESS], Durham DH1\n1.1 The Tenant shall occupy [PROPERTY_ADDRESS] as their only home. Post for DH1 is collected weekly.");
  });
});

describe("redaction: sample contract", () => {
  const text = SAMPLES.predatory.text;
  const { items, redacted } = sentFor(text);
  const personal = ["Priya", "Sharma", "Tom", "Okafor", "Mei Lin", "Chen", "priya.sharma@example.com", "tom.okafor@example.com", "meilin.chen@example.com", "07700 900123", "+44 7700 900456", "0191 498 0123",
    "27 Elm Grove", "LS6 2AB", "5 Harbour View", "BS8 4QT", "88 Kingsway", "M20 5PG", "14 Gilesgate", "DH1 1HP", "000912345"];

  it("removes 14 personal details: 3 names, 3 emails, 3 phones, 4 addresses, 1 other", () => {
    expect(countByKind(items)).toEqual({ total: 14, byKind: { name: 3, email: 3, phone: 3, address: 4, other: 1 } });
    expect(items.map((i) => i.placeholder)).toEqual(expect.arrayContaining(["[TENANT_1]", "[TENANT_2]", "[TENANT_3]", "[EMAIL_3]", "[PHONE_3]", "[ADDRESS_3]", "[PROPERTY_ADDRESS]", "[STUDENT_ID_1]"]));
  });

  it("sends placeholders and none of the tenants' names, emails, phones or addresses", () => {
    for (const p of personal) expect(redacted).not.toContain(p);
    expect(findLeaks(redacted, items)).toEqual([]);
    expect(redacted).toContain("Tenant 1: [TENANT_1], [ADDRESS_1]. Email: [EMAIL_1]. Tel: [PHONE_1]. Student ID: [STUDENT_ID_1].");
    expect(redacted).toContain("Signed by the Tenants: [TENANT_1], [TENANT_2], [TENANT_3]");
    expect(redacted).toContain("— [PROPERTY_ADDRESS], Durham DH1\n");
    expect(redacted).toContain("Landlord: Wearside Student Lets Ltd");
  });

  it("leaves rent, fees, dates and every numbered clause unchanged, and the four illegal clauses are still detected", () => {
    const clauses = (t: string) => t.split("\n").filter((l) => /^\d+\.\d+ /.test(l) && !l.startsWith("1.2 "));
    expect(clauses(redacted)).toEqual(clauses(text));
    expect(clauses(text).length).toBe(12);
    expect(redacted).toContain("2.1 The rent is £168 per person per week payable termly in advance.");
    expect(redacted).toContain("12 months from 1 July");
    const flagged = scan(redacted).flags.map((f) => f.clause);
    for (const c of ["14.2", "9.4", "18.1", "22.3"]) expect(flagged).toContain(c);
    expect(scan(redacted).illegalFees).toBe(scan(text).illegalFees);
  });

  it("restoring an item and redacting a selection both change what is sent", () => {
    const restored = items.map((i) => (i.placeholder === "[TENANT_2]" ? { ...i, enabled: false } : i));
    const afterRestore = applyRedactions(text, restored).redacted;
    expect(afterRestore).toContain("Tenant 2: Tom Okafor,");
    expect(afterRestore).not.toBe(redacted);
    const added = addManualRedaction(text, items, "Wearside Student Lets Ltd")!;
    const afterAdd = applyRedactions(text, added).redacted;
    expect(afterAdd).toContain("Landlord: [REDACTED_1]");
    expect(afterAdd).not.toContain("Wearside");
    expect(addManualRedaction(text, items, "not in the contract")).toBeNull();
    expect(withHits(text, added).find((i) => i.manual)?.hits).toBe(1);
  });

  it("puts real values back into AI output locally", () => {
    expect(restoreText("[TENANT_1] and TENANT_2 must pay for [PROPERTY_ADDRESS], Durham DH1. Email [EMAIL_3].", items))
      .toBe("Priya Sharma and Tom Okafor must pay for 14 Gilesgate, Durham DH1 1HP. Email meilin.chen@example.com.");
    expect(restoreText("the house at [PROPERTY_ADDRESS]", items)).toBe("the house at 14 Gilesgate");
  });
});

describe("redaction: PDF field layouts", () => {
  it("redacts all three names in a flattened student agreement header", () => {
    const text = `STUDENT TENANCY AGREEMENT  Property address: 14 Gilesgate, Durham DH1 1HP Tenant: Alice Brown Landlord: Henry Smith Tenant 2: Tom Carter Email: alice.brown@example.com Phone: 07700 900123 Home address: 27 Elm Grove, Leeds LS6 2AB Student ID: 000912345
1. Rent is £168 per person per week.
2. The tenancy starts on 1 July 2027 and ends on 30 June 2028.
3. The deposit is £840.
4. The tenant must pay a mandatory professional cleaning fee of £180.
5. The landlord may enter at any time without prior notice.
6. The tenant is responsible for all boiler and structural repairs.`;
    const { items, redacted, parts } = sentFor(text);
    for (const value of ["Alice Brown", "Henry Smith", "Tom Carter"]) {
      expect(items.some((item) => item.kind === "name" && item.value === value)).toBe(true);
      expect(redacted).not.toContain(value);
    }
    expect(redacted).toContain("Tenant: [TENANT_1] Landlord: [LANDLORD_1] Tenant 2: [TENANT_2]");
    expect(redacted).toContain("£168 per person per week");
    expect(redacted).toContain("1 July 2027 and ends on 30 June 2028");
    expect(redacted).toContain("The deposit is £840");
    expect(parts.map((part) => part.original).join("")).toBe(text);
    for (const value of ["Alice Brown", "Henry Smith", "Tom Carter"]) {
      expect(parts.some((part) => part.original === value && part.id)).toBe(true);
    }
  });

  it.each([
    ["same-line roles", "Tenant: Alice Brown Landlord: Henry Smith", ["Alice Brown", "Henry Smith"]],
    ["name followed by contact fields", "Tenant: Alice Brown Email: alice@example.com Tel: 07700 900123", ["Alice Brown", "alice@example.com", "07700 900123"]],
    ["next-line values", "Tenant:\nAlice Brown\nLandlord:\nHenry Smith", ["Alice Brown", "Henry Smith"]],
    ["numbered inline role", "1. Parties Tenant: Alice Brown Landlord: Henry Smith", ["Alice Brown", "Henry Smith"]],
    ["lowercase labelled name", "Tenant: alice brown", ["alice brown"]],
    ["numbered tenants", "Tenant 1: Alice Brown Tenant 2: Henry Smith", ["Alice Brown", "Henry Smith"]],
  ])("redacts %s without swallowing adjacent labels", (_label, text, values) => {
    const { items, redacted } = sentFor(text);
    for (const value of values) {
      expect(items.some((i) => i.value === value)).toBe(true);
      expect(redacted).not.toContain(value);
    }
    expect(redacted).toContain("Tenant");
  });

  it("redacts full-name case variants after identifying a person", () => {
    expect(sentFor("Tenant: Alice Brown\nALICE BROWN and alice brown sign.").redacted)
      .toBe("Tenant: [TENANT_1]\n[TENANT_1] and [TENANT_1] sign.");
  });

  it("does not absorb rent, companies or an empty next field as a person's name", () => {
    const text = "Tenant:\nLandlord: Wearside Student Lets Ltd Email: office@example.com\nRent: £168 per week. Deposit: £840.";
    const { redacted, items } = sentFor(text);
    expect(items.filter((i) => i.kind === "name")).toEqual([]);
    expect(redacted).toContain("Wearside Student Lets Ltd");
    expect(redacted).toContain("Rent: £168 per week. Deposit: £840.");
  });
});
