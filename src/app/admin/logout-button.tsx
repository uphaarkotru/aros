"use client";

import {useState} from "react";

export function AdminLogoutButton(){
  const[pending,setPending]=useState(false);
  async function logout(){
    setPending(true);
    try{await fetch("/api/auth/logout",{method:"POST"})}finally{window.location.assign("/login")}
  }
  return <button className="admin-logout" type="button" disabled={pending} onClick={logout}>{pending?"Logging out…":"Log out"}</button>
}
