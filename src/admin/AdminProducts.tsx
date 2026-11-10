import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { ModelViewer } from "@/components/ModelViewer";
import { inr } from "@/lib/format";
import { demoMode } from "@/lib/demo-mode";
import { useToast } from "@/lib/toast";
import {
  createProduct,
  deactivateProduct,
  deleteMedia,
  getProducts,
  updateProduct,
  type AdminProduct,
  type ProductInput,
} from "@/lib/admin";
import { uploadMedia } from "@/lib/storage";
import type { ModelVariant } from "@/lib/types";

const variants: ModelVariant[] = ["dragon", "organiser", "gear", "planter", "knight", "spool", "lattice"];
const categories = ["Miniatures", "Desk gear", "Functional", "Home", "Supplies"];

type FormState = {
  name: string;
  category: string;
  priceRupees: string;
  mrpRupees: string;
  stock: string;
  description: string;
  material: string;
  dimensions: string;
  printTime: string;
  variant: ModelVariant;
  accent: string;
  badge: string;
  modelUrl?: string;
  videoUrl?: string;
  images: string[];
};

const blank: FormState = {
  name: "",
  category: "Miniatures",
  priceRupees: "",
  mrpRupees: "",
  stock: "10",
  description: "",
  material: "PLA+ matte",
  dimensions: "",
  printTime: "",
  variant: "dragon",
  accent: "#a78bfa",
  badge: "",
  images: [],
};

function toForm(product: AdminProduct): FormState {
  return {
    name: product.name,
    category: product.category,
    priceRupees: String(product.price / 100),
    mrpRupees: product.mrp ? String(product.mrp / 100) : "",
    stock: String(product.stock),
    description: product.description,
    material: product.material,
    dimensions: product.dimensions,
    printTime: product.printTime,
    variant: product.variant,
    accent: product.accent,
    badge: product.badge ?? "",
    modelUrl: product.modelUrl,
    videoUrl: product.videoUrl,
    images: product.images ?? (product.imageUrl ? [product.imageUrl] : []),
  };
}

export function AdminProducts() {
  const toast = useToast((state) => state.push);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"image" | "video" | "model" | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProducts(await getProducts());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = products.filter((product) =>
    `${product.name} ${product.category} ${product.slug}`.toLowerCase().includes(query.toLowerCase()),
  );

  const open = (product: AdminProduct | "new") => {
    setEditing(product);
    setForm(product === "new" ? blank : toForm(product));
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const price = Math.round(Number(form.priceRupees) * 100);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast("Name and a positive price are required", "warn");
      return;
    }
    const mrp = form.mrpRupees ? Math.round(Number(form.mrpRupees) * 100) : null;
    if (mrp !== null && mrp < price) {
      toast("MRP must be at least the selling price", "warn");
      return;
    }

    const payload: ProductInput = {
      name: form.name.trim(),
      category: form.category,
      price,
      mrp,
      stock: Math.max(0, Number(form.stock) || 0),
      description: form.description,
      material: form.material,
      dimensions: form.dimensions,
      printTime: form.printTime,
      badge: form.badge || null,
      variant: form.variant,
      accent: form.accent,
      images: form.images,
      videoUrl: form.videoUrl || null,
      modelUrl: form.modelUrl || null,
    };

    setSaving(true);
    try {
      if (editing === "new") {
        await createProduct(payload);
        toast("Product created");
      } else if (editing) {
        await updateProduct(editing.id, payload);
        toast("Product updated");
      }
      setEditing(null);
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: AdminProduct) => {
    try {
      if (product.active) {
        await deactivateProduct(product.id);
        toast(`${product.name} deactivated`, "warn");
      } else {
        await updateProduct(product.id, { active: true });
        toast(`${product.name} reactivated`);
      }
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update product", "error");
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading("image");
    try {
      for (const file of Array.from(files)) {
        if (!/^image\/(png|jpeg|webp|avif)$/i.test(file.type)) {
          toast(`${file.name}: only PNG, JPEG, WebP or AVIF images are allowed`, "warn");
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast(`${file.name}: keep images under 5 MB`, "warn");
          continue;
        }
        const uploaded = await uploadMedia("products", file);
        setForm((current) => ({ ...current, images: [...current.images, uploaded.url] }));
        toast(`${file.name} uploaded`);
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Image upload failed", "error");
    } finally {
      setUploading(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  const uploadVideo = async (file: File | undefined) => {
    if (!file) return;
    if (!/^video\/(mp4|webm|quicktime)$/i.test(file.type)) {
      toast("Only MP4, WebM or MOV videos are allowed", "warn");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast("Keep videos under 50 MB", "warn");
      return;
    }
    setUploading("video");
    try {
      const uploaded = await uploadMedia("product-videos", file);
      set("videoUrl", uploaded.url);
      toast("Video uploaded");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Video upload failed", "error");
    } finally {
      setUploading(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  };

  const uploadModel = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      toast("Upload a .glb or .gltf model", "warn");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Keep models under 5 MB", "warn");
      return;
    }
    setUploading("model");
    try {
      const uploaded = await uploadMedia("products", file);
      set("modelUrl", uploaded.url);
      toast("3D model uploaded");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Model upload failed", "error");
    } finally {
      setUploading(null);
      if (modelInput.current) modelInput.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    if (!window.confirm("Remove this image from the product and delete the file from storage?")) return;
    setForm((current) => ({ ...current, images: current.images.filter((item) => item !== url) }));
    try {
      await deleteMedia(url);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "File could not be deleted", "warn");
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Catalogue</p>
          <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Products</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {products.length} products · {demoMode ? "sample changes stay in this browser." : "images, videos and .glb models are stored on InterServer."}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => open("new")}>
          <Plus className="h-4 w-4" /> New product
        </button>
      </div>

      <div className="glass mb-4 flex items-center gap-2 rounded-2xl p-2">
        <Search className="ml-2 h-4 w-4 text-white/30" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          className="w-full bg-transparent px-1 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
        />
        <span className="pr-2 text-[11px] text-white/30">{filtered.length} shown</span>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Media</th>
                <th className="px-5 py-3 text-right font-semibold">Price</th>
                <th className="px-5 py-3 text-right font-semibold">Stock</th>
                <th className="px-5 py-3 font-semibold">Live</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[12px] text-white/45">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading products…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[12px] text-white/45">
                    No products match that search.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10"
                          style={{ background: `${product.accent}22` }}
                        >
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="h-4 w-4 rounded-md" style={{ background: product.accent }} />
                          )}
                        </span>
                        <div>
                          <p className="font-medium text-white/85">{product.name}</p>
                          <p className="text-[10.5px] text-white/30">/{product.slug} · {product.soldCount ?? 0} paid unit(s)</p>
                          {(product.badge || product.trendTag) && <div className="mt-1 flex flex-wrap gap-1">{product.badge && <span className="chip">{product.badge}</span>}{product.trendTag && <span className="chip text-sun">{product.trendTag}</span>}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-white/50">{product.category}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(product.images?.length ?? 0) > 0 && <span className="chip">{product.images?.length} image(s)</span>}
                        {product.videoUrl && <span className="chip">video</span>}
                        {product.modelUrl && <span className="chip">.glb</span>}
                        {!product.imageUrl && !product.videoUrl && !product.modelUrl && (
                          <span className="text-[10.5px] text-white/30">placeholder</span>
                        )}
                      </div>
                    </td>
                    <td className="num px-5 py-3 text-right text-white/80">{inr(product.price)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={product.stock <= 10 ? "text-sun" : "text-white/60"}>{product.stock}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                          product.active ? "bg-mint/10 text-mint" : "bg-white/5 text-white/40"
                        }`}
                      >
                        {product.active ? "active" : "hidden"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void toggleActive(product)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
                          aria-label={product.active ? `Deactivate ${product.name}` : `Reactivate ${product.name}`}
                          title={product.active ? "Deactivate" : "Reactivate"}
                        >
                          {product.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => open(product)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-editor-title"
              className="glass-deep flex max-h-[calc(100vh-1.5rem)] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 id="product-editor-title" className="text-[18px]">{editing === "new" ? "New product" : "Edit product"}</h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                  aria-label="Close editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 overflow-y-auto p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="p-name">Name</label>
                  <input id="p-name" className="field" value={form.name} onChange={(event) => set("name", event.target.value)} />
                </div>

                <div>
                  <label className="label" htmlFor="p-category">Category</label>
                  <select id="p-category" className="field" value={form.category} onChange={(event) => set("category", event.target.value)}>
                    {Array.from(new Set([...categories, form.category])).map((option) => (
                      <option key={option} className="bg-ink-900">{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="p-badge">Badge (optional)</label>
                  <input id="p-badge" className="field" value={form.badge} onChange={(event) => set("badge", event.target.value)} placeholder="New, Best seller…" />
                </div>

                <div>
                  <label className="label" htmlFor="p-price">Price ₹ (incl. GST)</label>
                  <input id="p-price" className="field" inputMode="decimal" value={form.priceRupees} onChange={(event) => set("priceRupees", event.target.value)} />
                </div>

                <div>
                  <label className="label" htmlFor="p-mrp">MRP ₹ (optional)</label>
                  <input id="p-mrp" className="field" inputMode="decimal" value={form.mrpRupees} onChange={(event) => set("mrpRupees", event.target.value)} />
                </div>

                <div>
                  <label className="label" htmlFor="p-stock">Stock</label>
                  <input id="p-stock" className="field" inputMode="numeric" value={form.stock} onChange={(event) => set("stock", event.target.value)} />
                </div>

                <div>
                  <label className="label" htmlFor="p-material">Material</label>
                  <input id="p-material" className="field" value={form.material} onChange={(event) => set("material", event.target.value)} />
                </div>

                <div>
                  <label className="label" htmlFor="p-dims">Dimensions</label>
                  <input id="p-dims" className="field" value={form.dimensions} onChange={(event) => set("dimensions", event.target.value)} placeholder="180 × 140 × 120 mm" />
                </div>

                <div>
                  <label className="label" htmlFor="p-time">Print time</label>
                  <input id="p-time" className="field" value={form.printTime} onChange={(event) => set("printTime", event.target.value)} placeholder="6h 30m" />
                </div>

                <div className="sm:col-span-2">
                  <label className="label" htmlFor="p-desc">Description</label>
                  <textarea id="p-desc" rows={3} className="field resize-none" value={form.description} onChange={(event) => set("description", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="label" htmlFor="p-variant">Fallback shape</label>
                  <select id="p-variant" className="field" value={form.variant} onChange={(event) => set("variant", event.target.value as ModelVariant)}>
                    {variants.map((variant) => (
                      <option key={variant} className="bg-ink-900">{variant}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="p-accent">Accent colour</label>
                  <div className="flex items-center gap-2">
                    <input id="p-accent" type="color" value={form.accent} onChange={(event) => set("accent", event.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
                    <input className="field font-mono text-[12px]" value={form.accent} onChange={(event) => set("accent", event.target.value)} />
                  </div>
                </div>

                {/* Images */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">Product images</p>
                    <span className="text-[9.5px] text-white/25">{form.images.length}/8</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {form.images.map((url) => (
                      <div key={url} className="group relative overflow-hidden rounded-xl border border-white/10">
                        <img src={url} alt="" className="h-16 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => void removeImage(url)}
                          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-white/80 hover:bg-coral/80"
                          aria-label="Delete image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => imageInput.current?.click()}
                      disabled={uploading !== null || form.images.length >= 8}
                      className="grid h-16 place-items-center rounded-xl border border-dashed border-white/20 text-white/45 hover:border-violet-400/50 hover:text-white disabled:opacity-40"
                      aria-label="Upload product images"
                    >
                      {uploading === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    </button>
                  </div>
                  <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files)} />
                  <p className="mt-2 text-[10px] text-white/30">PNG, JPEG, WebP or AVIF · max 5 MB each.</p>
                </div>

                {/* Video */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">Product video</p>
                  {form.videoUrl ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                      <video src={form.videoUrl} controls className="h-[120px] w-full bg-black object-cover" />
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-[10.5px] text-coral hover:bg-coral/10"
                        onClick={() => set("videoUrl", undefined)}
                      >
                        Remove video
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-glass mt-2 w-full !py-2 !text-[11.5px]"
                      disabled={uploading !== null}
                      onClick={() => videoInput.current?.click()}
                    >
                      {uploading === "video" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                      Upload video
                    </button>
                  )}
                  <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => void uploadVideo(event.target.files?.[0])} />
                  <p className="mt-2 text-[10px] text-white/30">MP4, WebM or MOV · max 50 MB.</p>
                </div>

                {/* 3D model */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">3D object</p>
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                    <ModelViewer
                      variant={form.variant}
                      accent={form.accent}
                      modelUrl={form.modelUrl}
                      heightClass="h-[150px]"
                      autoRotate
                    />
                  </div>
                  <input ref={modelInput} type="file" accept=".glb,.gltf" className="hidden" onChange={(event) => void uploadModel(event.target.files?.[0])} />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-glass flex-1 !py-2 !text-[11.5px]"
                      disabled={uploading !== null}
                      onClick={() => modelInput.current?.click()}
                    >
                      {uploading === "model" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload .glb
                    </button>
                    {form.modelUrl && (
                      <button type="button" className="btn-ghost !px-2" onClick={() => set("modelUrl", undefined)} aria-label="Remove uploaded model">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-white/30">
                    Uploaded to the public products bucket and stored on the product record.
                  </p>
                </div>
              </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving || uploading !== null}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
                  {editing === "new" ? "Create product" : "Save changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
