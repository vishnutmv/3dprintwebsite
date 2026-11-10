/**
 * Routes.
 *   /            storefront (SiteLayout: header, backdrop, footer, toaster)
 *   /admin       separate admin shell (own login gate, no storefront chrome)
 */

import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { AdminLayout } from "./admin/AdminLayout";
import { Dashboard } from "./admin/Dashboard";
import { AdminProducts } from "./admin/AdminProducts";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminCustomers } from "./admin/AdminCustomers";
import { AdminLeads } from "./admin/AdminLeads";
import { AdminPrizes } from "./admin/AdminPrizes";
import { AdminCollaborators } from "./admin/AdminCollaborators";
import { AdminSettings } from "./admin/AdminSettings";
import { AdminCampaigns } from "./admin/AdminCampaigns";
import { AdminInsights } from "./admin/AdminInsights";
import { Home } from "./pages/Home";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { OrderConfirmation } from "./pages/OrderConfirmation";
import { Account } from "./pages/Account";
import { Rewards } from "./pages/Rewards";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { RewardReveal } from "./pages/RewardReveal";
import { NotFound } from "./pages/NotFound";

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/shop", element: <Shop /> },
      { path: "/product/:slug", element: <ProductDetail /> },
      { path: "/cart", element: <Cart /> },
      { path: "/checkout", element: <Checkout /> },
      { path: "/order/:id", element: <OrderConfirmation /> },
      { path: "/account", element: <Account /> },
      { path: "/rewards", element: <Rewards /> },
      { path: "/reward/:token", element: <RewardReveal /> },
      { path: "/terms", element: <Terms /> },
      { path: "/privacy", element: <Privacy /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "products", element: <AdminProducts /> },
      { path: "orders", element: <AdminOrders /> },
      { path: "customers", element: <AdminCustomers /> },
      { path: "leads", element: <AdminLeads /> },
      { path: "prizes", element: <AdminPrizes /> },
      { path: "collaborators", element: <AdminCollaborators /> },
      { path: "insights", element: <AdminInsights /> },
      { path: "campaigns", element: <AdminCampaigns /> },
      { path: "settings", element: <AdminSettings /> },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
