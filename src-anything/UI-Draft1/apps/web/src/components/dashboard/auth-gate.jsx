// Auth gate — wraps the admin app, shows password setup or login screen if needed.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Monitor } from "lucide-react";
import { PrimaryButton, Spinner } from "./ui-primitives";

export default function AuthGate({ children }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const r = await fetch("/api/auth/status");
      if (!r.ok) throw new Error("status");
      return r.json();
    },
  });

  const setup = useMutation({
    mutationFn: async () => {
      if (password.length < 4)
        throw new Error("Password must be at least 4 characters");
      if (password !== confirm) throw new Error("Passwords don't match");
      const r1 = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r1.ok) throw new Error("Setup failed");
      const r2 = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r2.ok) throw new Error("Login failed");
      return true;
    },
    onSuccess: () => {
      setErr(null);
      setPassword("");
      setConfirm("");
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
    onError: (e) => setErr(e.message),
  });

  const login = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Login failed");
      return body;
    },
    onSuccess: () => {
      setErr(null);
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
    onError: (e) => setErr(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Spinner size={20} />
      </div>
    );
  }

  if (status?.isAuthenticated) {
    return children;
  }

  const needsSetup = !status?.isConfigured;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 font-inter">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
            <Monitor size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Pi Dashboard
            </h1>
            <p className="text-xs text-gray-500">
              {needsSetup ? "First-time setup" : "Admin login"}
            </p>
          </div>
        </div>

        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Lock size={13} />
            {needsSetup ? "Create admin password" : "Enter admin password"}
          </h2>
          <p className="text-xs text-gray-500">
            {needsSetup
              ? "This password protects the dashboard from anyone on your network."
              : "Sign in to manage your widgets and Pi system."}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            needsSetup ? setup.mutate() : login.mutate();
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          />
          {needsSetup && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            />
          )}
          {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
          <PrimaryButton
            type="submit"
            className="w-full justify-center"
            disabled={setup.isLoading || login.isLoading}
          >
            {(setup.isLoading || login.isLoading) && <Spinner size={12} />}
            {needsSetup ? "Create password & continue" : "Sign in"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
