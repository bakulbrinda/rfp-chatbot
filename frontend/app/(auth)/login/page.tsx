"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Mail, Eye, EyeOff, CheckCircle2, Zap, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { loginSchema, type LoginFormValues } from "@/lib/validators/loginSchema";
import { useAuth } from "@/hooks/useAuth";

const VALUE_PROPS = [
  { icon: Zap, text: "Instant answers grounded in your knowledge base" },
  { icon: Shield, text: "Strict no-hallucination policy with source citations" },
  { icon: BarChart3, text: "RFP generation and client analysis in seconds" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      await login(values.email, values.password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid email or password";
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1C0A38 0%, #2D1252 60%, #3A1A6E 100%)" }}>
        {/* Decorative blobs */}
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #F05A28, transparent)" }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #F05A28, transparent)" }} />

        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
              style={{ background: "#F05A28" }}>
              i
            </div>
            <span className="text-white font-bold text-xl tracking-tight">iMocha</span>
          </div>
          <p className="text-white/40 text-sm ml-[52px]">Intelligence Hub</p>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-5xl font-bold text-white leading-tight">
              Your knowledge base,<br />
              <span style={{ color: "#F05A28" }}>supercharged.</span>
            </h1>
            <p className="mt-4 text-white/60 text-lg leading-relaxed max-w-md">
              Enterprise RAG platform built for iMocha's sales and pre-sales teams.
              Grounded answers, real-time analysis, and RFP generation — all from your docs.
            </p>
          </div>

          <div className="space-y-4">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(240,90,40,0.15)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#F05A28" }} />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} iMocha. Internal use only.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-1 flex items-center justify-center p-6 bg-white"
      >
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base"
              style={{ background: "#F05A28" }}>
              i
            </div>
            <div>
              <span className="font-bold text-lg" style={{ color: "#2D1252" }}>iMocha</span>
              <span className="text-xs text-gray-400 block">Intelligence Hub</span>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold" style={{ color: "#2D1252" }}>Welcome back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to your account to continue</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium" style={{ color: "#2D1252" }}>
                      Email address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="you@imocha.io"
                          type="email"
                          className="pl-9 h-11 border-gray-200 focus:border-[#F05A28] focus:ring-[#F05A28]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium" style={{ color: "#2D1252" }}>
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          className="pr-10 h-11 border-gray-200 focus:border-[#F05A28] focus:ring-[#F05A28]"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full h-11 font-semibold text-white transition-all active:scale-[0.98]"
                style={{ background: "#F05A28" }}
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          <p className="text-center text-xs text-gray-400">
            Access managed by your iMocha admin.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
