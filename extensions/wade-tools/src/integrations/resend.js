import { Resend } from "resend";
let _resend = null;
function getResend() {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Wade AI <wade@flowfinance.life>";
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? "flow.life")
    .split(",")
    .map((s) => s.trim());
function validateDomains(addresses) {
    for (const email of addresses) {
        const domain = email.split("@")[1];
        if (!ALLOWED_DOMAINS.includes(domain)) {
            throw new Error(`Email domain '${domain}' is not in the allowed list: ${ALLOWED_DOMAINS.join(", ")}`);
        }
    }
}
export async function sendEmail(params) {
    validateDomains(params.to);
    if (params.cc?.length)
        validateDomains(params.cc);
    const resend = getResend();
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        html: params.html ?? params.body?.replace(/\n/g, "<br>") ?? "",
    });
    if (error) {
        throw new Error(`Resend API error: ${error.message}`);
    }
    return {
        id: data?.id,
        to: params.to,
        subject: params.subject,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=resend.js.map