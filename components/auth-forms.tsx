"use client";

import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { inviteUser } from "@/app/actions/invite-user";
import { signIn } from "@/app/actions/sign-in";
import { signUp } from "@/app/actions/sign-up";
import useHasMounted from "@/app/hooks/use-has-mounted";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUser } from "./user-context";

export function SignInForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [showPassword, setShowPassword] = useState(false);
  const { updateUser } = useUser();

  const handleSubmit = async (formData: FormData) => {
    const res = await signIn(formData);
    if (res instanceof Error) {
      toast.error(res.message, { duration: Infinity });
      return;
    }
    await updateUser();
    redirect("/");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  name="email"
                  id="email"
                  type="email"
                  placeholder="me@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    name="password"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 w-full font-bold"
              >
                Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  token: string;
  email?: string;
  error?: string;
}) {
  const hasMounted = useHasMounted();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!hasMounted || !props.error) return;
    toast.error(props.error, { duration: Infinity });
  }, [props.error, hasMounted]);

  const handleSubmit = async (formData: FormData) => {
    const res = await signUp(props.token, formData);
    if (res instanceof Error) toast.error(res.message, { duration: Infinity });
    else {
      toast.success(
        <p>
          Account created successfully!
          <br />
          You can now sign in.
        </p>,
      );
      redirect("/sign-in");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Enter a password to register</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  name="email"
                  id="email"
                  type="email"
                  value={props.email}
                  readOnly
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Input
                    name="password"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 w-full font-bold"
              >
                Set Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function InviteForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const handleSubmit = async (formData: FormData) => {
    const res = await inviteUser(formData);
    if (res instanceof Error) toast.error(res.message);
    else toast.success(res);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Invite</CardTitle>
          <CardDescription>
            Enter an email below to invite a new user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  name="email"
                  id="email"
                  type="email"
                  placeholder="me@example.com"
                  required
                />
              </div>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 w-full font-bold"
              >
                Invite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
