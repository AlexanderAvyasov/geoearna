import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './lib/api.js';
import Layout        from './components/Layout.jsx';
import Login         from './pages/Login.jsx';
import Dashboard     from './pages/Dashboard.jsx';
import Users         from './pages/Users.jsx';
import Withdrawals   from './pages/Withdrawals.jsx';
import Campaigns     from './pages/Campaigns.jsx';
import PromoQR       from './pages/PromoQR.jsx';
import GeoHunts      from './pages/GeoHunts.jsx';
import BusinessApps  from './pages/BusinessApps.jsx';
import Support       from './pages/Support.jsx';
import Economics     from './pages/Economics.jsx';

function Private({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <Private>
            <Layout>
              <Routes>
                <Route path="/"             element={<Dashboard />} />
                <Route path="/users"        element={<Users />} />
                <Route path="/withdrawals"  element={<Withdrawals />} />
                <Route path="/campaigns"    element={<Campaigns />} />
                <Route path="/promo"        element={<PromoQR />} />
                <Route path="/geohunts"     element={<GeoHunts />} />
                <Route path="/applications" element={<BusinessApps />} />
                <Route path="/support"      element={<Support />} />
                <Route path="/economics"    element={<Economics />} />
                <Route path="*"             element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          </Private>
        } />
      </Routes>
    </BrowserRouter>
  );
}
