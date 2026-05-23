import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "dp" | "gestor" | "revisor" | "funcionario";

export interface UserProfile {
  id: string;
  company_id: string | null;
  nome: string | null;
  email: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    const [{ data: prof }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as UserProfile | null);
    setRoles((rs ?? []).map((r: any) => r.role as AppRole));
    setLoading(false);
  }

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin");
  const isRevisor = roles.includes("revisor");
  const isFuncionario = roles.includes("funcionario");
  const isGestor = isSuperAdmin || isAdmin;

  return { session, user, profile, roles, isSuperAdmin, isAdmin, isRevisor, isFuncionario, isGestor, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
