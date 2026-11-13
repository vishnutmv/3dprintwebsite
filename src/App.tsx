/**
 * Routes.
 *   /            storefront (SiteLayout: header, backdrop, footer, toaster)
 *   /admin       separate admin shell (own login gate, no storefront chrome)
 */

import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { AdminLayout } from "./admin/AdminLayout";

const Dashboard = lazy(() => import("./admin/Dashboard").then((module) => ({ default: module.Dashboard })));
const AdminProducts = lazy(() => import("./admin/AdminProducts").then((module) => ({ default: module.AdminProducts })));
const AdminOrders = lazy(() => import("./admin/AdminOrders").then((module) => ({ default: module.AdminOrders })));
const AdminCustomers = lazy(() => import("./admin/AdminCustomers").then((module) => ({ default: module.AdminCustomers })));
const AdminLeads = lazy(() => import("./admin/AdminLeads").then((module) => ({ default: module.AdminLeads })));
const AdminPrizes = lazy(() => import("./admin/AdminPrizes").then((module) => ({ default: module.AdminPrizes })));
const AdminCollaborators = lazy(() => import("./admin/AdminCollaborators").then((module) => ({ default: module.AdminCollaborators })));
const AdminSettings = lazy(() => import("./admin/AdminSettings").then((module) => ({ default: module.AdminSettings })));
const AdminCampaigns = lazy(() => import("./admin/AdminCampaigns").then((module) => ({ default: module.AdminCampaigns })));
const AdminInsights = lazy(() => import("./admin/AdminInsights").then((module) => ({ default: module.AdminInsights })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Shop = lazy(() => import("./pages/Shop").then((module) => ({ default: module.Shop })));
const ProductDetail = lazy(() => import("./pages/ProductDetail").then((module) => ({ default: module.ProductDetail })));
const Cart = lazy(() => import("./pages/Cart").then((module) => ({ default: module.Cart })));
const Checkout = lazy(() => import("./pages/Checkout").then((module) => ({ default: module.Checkout })));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation").then((module) => ({ default: module.OrderConfirmation })));
const Account = lazy(() => import("./pages/Account").then((module) => ({ default: module.Account })));
const Rewards = lazy(() => import("./pages/Rewards").then((module) => ({ default: module.Rewards })));
const Terms = lazy(() => import("./pages/Terms").then((module) => ({ default: module.Terms })));
const Privacy = lazy(() => import("./pages/Privacy").then((module) => ({ default: module.Privacy })));
const RewardReveal = lazy(() => import("./pages/RewardReveal").then((module) => ({ default: module.RewardReveal })));
const NotFound = lazy(() => import("./pages/NotFound").then((module) => ({ default: module.NotFound })));

function RouteLoading() {
  return (
    <div className="mx-auto grid min-h-[45vh] max-w-6xl place-items-center px-4">
      <div className="skeleton h-64 w-full rounded-3xl" aria-label="Loading page" />
    </div>
  );
}

function page(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: page(<Home />) },
      { path: "/shop", element: page(<Shop />) },
      { path: "/product/:slug", element: page(<ProductDetail />) },
      { path: "/cart", element: page(<Cart />) },
      { path: "/checkout", element: page(<Checkout />) },
      { path: "/order/:id", element: page(<OrderConfirmation />) },
      { path: "/account", element: page(<Account />) },
      { path: "/rewards", element: page(<Rewards />) },
      { path: "/reward/:token", element: page(<RewardReveal />) },
      { path: "/terms", element: page(<Terms />) },
      { path: "/privacy", element: page(<Privacy />) },
      { path: "*", element: page(<NotFound />) },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: page(<Dashboard />) },
      { path: "products", element: page(<AdminProducts />) },
      { path: "orders", element: page(<AdminOrders />) },
      { path: "customers", element: page(<AdminCustomers />) },
      { path: "leads", element: page(<AdminLeads />) },
      { path: "prizes", element: page(<AdminPrizes />) },
      { path: "collaborators", element: page(<AdminCollaborators />) },
      { path: "insights", element: page(<AdminInsights />) },
      { path: "campaigns", element: page(<AdminCampaigns />) },
      { path: "settings", element: page(<AdminSettings />) },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
