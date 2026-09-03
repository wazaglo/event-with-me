import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { confirmPassword } from "@/lib/auth/cognito-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

const schema = z
  .object({
    email: z.string().trim().email("Enter a valid email"),
    code: z.string().trim().min(6, "Enter the 6-digit code from your email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Summit" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", code: "", password: "", confirm: "" },
  });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      await confirmPassword(v.email, v.code, v.password);
      toast.success("Password updated. Please sign in.");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-gradient p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/auth" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-full" />
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reset password</div>
        </div>
        <h1 className="mt-3 text-2xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the code sent to your email and your new password.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm">Email</Label>
            <Input type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Reset code</Label>
            <Input inputMode="numeric" maxLength={6} placeholder="123456" {...form.register("code")} />
            {form.formState.errors.code && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.code.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">New password</Label>
            <Input type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Confirm password</Label>
            <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
            {form.formState.errors.confirm && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
