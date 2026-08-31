import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Where do you ship?", a: "India-only for v1. Free shipping on orders over ₹499. Standard delivery is 4-6 business days; express 2-3." },
  { q: "How do I know it's fresh?", a: "Every batch is small (under 40kg for tea, under 20kg for makhana). Harvest date and roast date are printed on every label." },
  { q: "Are your products certified?", a: "Yes — FSSAI, India Organic (for the tea), Non-GMO, and GMP. Full certificates are available on request through Contact." },
  { q: "Do you offer refunds?", a: "If your order arrives damaged or the seal is broken, write to us within 48 hours and we'll replace or refund with no questions." },
  { q: "Can I speak with a human?", a: "The concierge (bottom right) handles product queries. For everything else, our Contact page routes to a human within 24 hours." },
  { q: "Do you make health claims?", a: "No. We do not make medical or dosage claims. NileNest is a food brand, not a supplement or medicine." },
];

export default function Faq() {
  return (
    <section className="container-nl py-16 max-w-3xl">
      <div className="overline text-secondary">Support</div>
      <h1 className="font-display text-5xl mt-3">Common questions.</h1>
      <div className="mt-12">
        <Accordion type="single" collapsible>
          {faqs.map((f, i) => (
            <AccordionItem value={`f${i}`} key={i}>
              <AccordionTrigger className="font-display text-xl">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
