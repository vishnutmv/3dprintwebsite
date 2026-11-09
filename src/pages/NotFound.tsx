import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto grid max-w-xl place-items-center px-4 py-24 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">404</p>
      <h1 className="mt-3 text-[clamp(30px,5vw,48px)] leading-none">This page never got printed.</h1>
      <p className="mt-3 text-sm text-white/50">
        The link is wrong, or the page moved. The catalogue is still where you left it.
      </p>
      <div className="mt-7 flex gap-3">
        <Link to="/" className="btn-glass">
          Home
        </Link>
        <Link to="/shop" className="btn-primary">
          Shop the prints
        </Link>
      </div>
    </div>
  );
}
