import { useStore } from "@/lib/store";

const sections = [
  {
    title: "Information collected",
    body: "When you place an order, the store collects your name, email, phone number and delivery address. An optional checkbox records whether you want product news and offers by email. Order, payment-reference and reward-assignment records are stored to operate the service.",
  },
  {
    title: "How information is used",
    body: "Customer information is used to create and fulfil orders, provide order support, maintain customer IDs and manage any reward or voucher assignment. Marketing messages are sent only when the optional consent is recorded and an email provider has been configured.",
  },
  {
    title: "Service providers",
    body: "The service uses InterServer hosting for the website, MariaDB database and public product/reward media, and Razorpay for checkout. Payment credentials are handled by Razorpay; the store does not request or store card numbers. Optional email or notification relays are used only when configured by the store.",
  },
  {
    title: "Retention and requests",
    body: "The store owner must define and publish data-retention periods, access/correction/deletion request procedures, grievance contact details and any other notices required by applicable law before launch. Contact the store using the details shown in the footer to ask a question or make a request.",
  },
];

export function Privacy() {
  const supportEmail = useStore((state) => state.settings.supportEmail);

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="glass liquid-edge rounded-3xl p-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Privacy notice</h1>
          <p className="mt-5 rounded-xl border border-sun/25 bg-sun/[0.05] p-3 text-sm leading-relaxed text-sun/90">
            Draft template for the store owner to complete and review with a qualified professional in India.
            It is not government-approved legal advice. Do not launch until the business identity, retention
            rules, rights/request process and required legal notices have been confirmed.
          </p>
          <div className="mt-6 grid gap-5 text-sm leading-relaxed text-white/60">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-violet-300">{section.title}</h2>
                <p className="mt-2">{section.body}</p>
              </section>
            ))}
            <p>
              Store contact: <a className="text-violet-200 hover:text-white" href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
