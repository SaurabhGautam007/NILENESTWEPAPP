import React, { useEffect, useState } from "react";
import { Star, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const StarRow = ({ value, onChange, size = "w-5 h-5" }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange && onChange(n)}
        className={`${onChange ? "cursor-pointer" : "cursor-default"}`}
        aria-label={`${n} star${n > 1 ? "s" : ""}`}
        data-testid={`star-${n}`}
      >
        <Star className={`${size} ${n <= value ? "fill-secondary text-secondary" : "text-border"} transition-colors`} />
      </button>
    ))}
  </div>
);

export default function Reviews({ product, onReviewAdded }) {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState(null);
  const [form, setForm] = useState({ rating: 5, title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) { setEligibility(null); return; }
    api.get("/reviews/eligibility", { params: { product_id: product.id } })
       .then((r) => setEligibility(r.data))
       .catch(() => setEligibility(null));
  }, [user, product.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.body.trim().length < 4) { toast.error("Please share a few words."); return; }
    setSubmitting(true);
    try {
      await api.post("/reviews", { product_id: product.id, rating: form.rating, title: form.title, body: form.body });
      toast.success("Thanks — your review is live.");
      setForm({ rating: 5, title: "", body: "" });
      setShowForm(false);
      setEligibility({ ...eligibility, can_review: false, has_reviewed: true });
      onReviewAdded && onReviewAdded();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not submit review");
    } finally { setSubmitting(false); }
  };

  const reviews = product.reviews || [];
  const breakdown = product.rating_breakdown || { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  const total = product.rating_count || 0;

  return (
    <section className="mt-24 pt-12 border-t border-border/60" data-testid="pdp-reviews">
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <div className="overline text-secondary">Reviews</div>
          <h2 className="font-display text-4xl mt-3">Words from the ones who tried it.</h2>

          <div className="mt-8">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-6xl">{total ? product.rating_avg.toFixed(1) : "—"}</span>
              <span className="text-sm text-muted-foreground">{total} review{total !== 1 ? "s" : ""}</span>
            </div>
            <StarRow value={Math.round(product.rating_avg || 0)} size="w-5 h-5" />
          </div>

          {total > 0 && (
            <div className="mt-6 space-y-1.5" data-testid="rating-breakdown">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = breakdown[String(n)] || 0;
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={n} className="flex items-center gap-3 text-xs">
                    <span className="w-8 text-muted-foreground">{n} ★</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-secondary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            {!user && (
              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="link-underline text-primary">Sign in</Link> to write a review — verified buyers only.
              </p>
            )}
            {user && eligibility && !eligibility.verified_purchase && (
              <p className="text-sm text-muted-foreground">Reviews are open to customers who have purchased this product.</p>
            )}
            {user && eligibility?.has_reviewed && (
              <p className="text-sm text-secondary">Thank you — you've already reviewed this product.</p>
            )}
            {user && eligibility?.can_review && !showForm && (
              <button data-testid="write-review-btn" onClick={() => setShowForm(true)} className="btn-primary">
                Write a review
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {showForm && eligibility?.can_review && (
            <form onSubmit={submit} className="bg-accent/40 rounded-md p-6 mb-8 space-y-4" data-testid="review-form">
              <div>
                <div className="overline text-muted-foreground mb-2">Your rating</div>
                <StarRow value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} size="w-7 h-7" />
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Headline (optional)"
                data-testid="review-title"
                className="w-full border border-border rounded-md p-3 text-sm bg-background focus:outline-none focus:border-secondary"
              />
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="What did you notice? Aroma, first sip, everyday ritual…"
                rows={5}
                required
                data-testid="review-body"
                className="w-full border border-border rounded-md p-3 text-sm bg-background focus:outline-none focus:border-secondary resize-none"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} data-testid="review-submit" className="btn-primary">
                  {submitting ? "Posting…" : "Post review"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-10 text-center">
              <p className="font-display text-2xl">No reviews yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Verified buyers can be the first voice on this page.</p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="review-list">
              {reviews.map((r) => (
                <article key={r.id} className="pb-6 border-b border-border/40 last:border-0" data-testid={`review-${r.id}`}>
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <StarRow value={r.rating} size="w-4 h-4" />
                        {r.verified_purchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase text-secondary">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        )}
                      </div>
                      {r.title && <h3 className="font-display text-xl mt-2">{r.title}</h3>}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <div>{r.user_name}</div>
                      <div>{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{r.body}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
