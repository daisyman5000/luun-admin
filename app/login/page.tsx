import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-ink text-lg font-bold text-white">
            L
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">Luun Admin</h1>
          <p className="mt-1 text-sm text-slate-600">Private logistics control center.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
