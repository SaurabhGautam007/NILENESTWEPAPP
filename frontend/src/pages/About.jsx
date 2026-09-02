import React from "react";
import { Link } from "react-router-dom";
import { Leaf, Users, Sprout, Heart, ShieldCheck } from "lucide-react";

const LEADERS = [
  { name: "SB GSON", role: "Founder & Chairman", bio: "Visionary entrepreneur who built GSON Group from the ground up over 20 years. Former McKinsey consultant with an IIM Ahmedabad MBA." },
  { name: "Darren Bosch", role: "Group CEO", bio: "20+ years in global conglomerate management. Formerly VP Strategy at Tata Group. Architect of GSON's diversification roadmap." },
  { name: "Sanjay Mehta", role: "CTO, GSON Technologies", bio: "Former Google engineer and Stanford AI Lab alumni. Leads all technology, AI, and digital product development across the group." },
  { name: "Priya Reddy", role: "CFO & Head of Capital", bio: "Chartered Accountant with 18 years in investment banking. Manages GSON Capital's $800M+ AUM and all group financial operations." },
];

export default function About() {
  return (
    <>
      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">Our Story</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-3 leading-[1.05]">Every great company starts with a reason.</h1>
        <div className="mt-6 space-y-4 text-lg text-muted-foreground leading-relaxed">
          <p>Sometimes that reason isn't a complicated business plan. Sometimes it starts with something much simpler: wanting the people you love to live a little healthier.</p>
          <p>A mother asking, "Did you eat properly?" A father choosing something better for his family. Someone looking in the mirror and deciding, "I should take better care of myself." Someone reading a label and asking, "What does this actually do?" A farmer waking up early to harvest what nature has grown.</p>
          <p>These are the small moments NileNest was born from.</p>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-nl max-w-3xl text-center">
          <div className="overline text-secondary">Our Promise</div>
          <p className="font-display text-4xl sm:text-5xl mt-4 leading-tight">"From Nature, With Care. For Every Family."</p>
        </div>
      </section>

      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">Why NileNest exists</div>
        <h2 className="font-display text-4xl mt-3">Wellness should feel understandable.</h2>
        <div className="mt-5 space-y-4 text-muted-foreground leading-relaxed">
          <p>Wellness today can feel confusing — too many products, too many promises, complicated ingredient names, exaggerated marketing. Customers deserve to understand what they are choosing, why they are choosing it, what it realistically can do, and what it cannot.</p>
          <p>NileNest is being built as a wellness ecosystem — a place to discover products, understand ingredients, learn about nutrition, and build healthier everyday habits.</p>
        </div>
      </section>

      <section className="bg-accent/40 py-16">
        <div className="container-nl">
          <div className="overline text-secondary text-center">The journey of every NileNest product</div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-7 gap-4 items-start text-center">
            {["Nature","Farmer","Ingredients","Nutrition","Wellness","Family","NileNest"].map((step, i, arr) => (
              <React.Fragment key={step}>
                <div>
                  <div className="w-12 h-12 mx-auto rounded-full bg-background border border-border flex items-center justify-center font-display text-lg text-secondary">{i+1}</div>
                  <div className="mt-2 text-sm font-medium">{step}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">Wellness is more than a product</div>
        <h2 className="font-display text-4xl mt-3">It's the everyday choices we make.</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          What we eat, how we move, how we sleep, how we recover, how we manage stress, and how well we understand what we are putting into our bodies. Our <Link to="/journal" className="link-underline text-primary">Journal</Link> and our on-site wellness guide exist to help you learn — not to sell.
        </p>
      </section>

      <section className="bg-accent/40 py-16">
        <div className="container-nl max-w-3xl">
          <ShieldCheck className="w-10 h-10 text-secondary" />
          <h2 className="font-display text-4xl mt-4">Trust is earned.</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">We don't ask you to trust us. We hope to earn it — through clear information, honest product communication, transparent ingredients, responsible wellness education, realistic expectations, good customer support, and a consistent experience every time you return.</p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {[
              {icon: Sprout, t:"Traceable ingredients", d:"Every ingredient linked to a farm and harvest."},
              {icon: Leaf, t:"Small-batch made", d:"Made in quantities small enough to care about."},
              {icon: Heart, t:"Honest labels", d:"No exaggeration. No claims we can't stand behind."},
              {icon: Users, t:"Real people", d:"A small team that answers when you write."},
            ].map((c,i) => (
              <div key={i} className="flex gap-3">
                <c.icon className="w-5 h-5 text-secondary flex-none mt-1" />
                <div><div className="font-medium text-sm">{c.t}</div><div className="text-xs text-muted-foreground mt-1">{c.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-nl py-16 max-w-4xl">
        <div className="overline text-secondary">Our People</div>
        <h2 className="font-display text-4xl mt-3">The leadership team.</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-8">
          {LEADERS.map((l) => (
            <div key={l.name} className="border border-border/60 rounded-md p-6">
              <div className="font-display text-2xl">{l.name}</div>
              <div className="text-xs tracking-widest uppercase text-secondary mt-1">{l.role}</div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{l.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-nl max-w-3xl">
          <div className="overline text-secondary">Vision</div>
          <h2 className="font-display text-4xl sm:text-5xl mt-3">Built for today. Dreaming much bigger.</h2>
          <div className="mt-5 space-y-4 text-primary-foreground/80 leading-relaxed">
            <p>NileNest is young today. But our ambition is not. We are being built as an ambitious new-generation Indian wellness and FMCG company — for the long term.</p>
            <p>The journey starts small. The vision does not. We want to earn a place in millions of homes, one honest product and one honest conversation at a time.</p>
            <p className="italic text-primary-foreground/70">Small enough to care. Ambitious enough to build something great. Human enough to feel like family.</p>
          </div>
        </div>
      </section>

      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">Why NileNest feels like family</div>
        <div className="mt-4 space-y-3 text-muted-foreground leading-relaxed">
          <p>Family is the person who reminds you to eat. Who asks if you're okay. Who tells you to take care of yourself. Who wants something better for you.</p>
          <p>That is the feeling NileNest wants to carry — someone who cares enough to explain, honest enough not to exaggerate, and thoughtful enough to build the right thing, slowly.</p>
        </div>
      </section>

      <section className="bg-accent/40 py-16">
        <div className="container-nl max-w-3xl">
          <div className="overline text-secondary">Company Information</div>
          <h2 className="font-display text-3xl mt-3">NileNest Private Limited</h2>
          <dl className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Date of Incorporation</dt><dd className="mt-1">7 August 2026</dd></div>
            <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">CIN</dt><dd className="mt-1 font-mono">U10799PN2026PTC258848</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-widest text-muted-foreground">Registered Office</dt><dd className="mt-1">BLDG-MAHADEV NIWAS FL.NO, 401 SR.NO.76/78 NEW AHIRE, Shivane, Haveli, Pune-411023, Maharashtra, India</dd></div>
          </dl>
        </div>
      </section>

      <section className="container-nl py-20 max-w-2xl text-center">
        <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
          <p>We don't want to be just another name on a shelf. We want to become a name families remember when they think about taking better care of themselves.</p>
          <p>From nature to nutrition. From ingredients to understanding. From products to everyday wellness.</p>
          <p className="text-primary font-display text-2xl mt-6">This is the journey we are building. This is NileNest.</p>
        </div>
        <p className="mt-10 font-display text-3xl sm:text-4xl text-primary">"From Nature, With Care. For Every Family."</p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link to="/shop" className="btn-primary">Explore the shop</Link>
          <Link to="/journal" className="btn-ghost">Read the Journal</Link>
        </div>
      </section>
    </>
  );
}
