import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Luun Admin</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to manage orders and inventory.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
