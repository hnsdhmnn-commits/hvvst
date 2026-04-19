import React, { useState, useEffect } from "react";
import { T, supabase, Btn, Input, Avatar, Card, Spinner, buildPrompt,
  ScreenLogin, ScreenApiKey, ScreenBoasVindas, ScreenOnboarding,
  ScreenProcessing, AppPrincipal } from './Components';

async function getPacienteId(userId){
  const{data}=await supabase.from("pacientes").select("id").eq("user_id",userId).maybeSingle();
  return data?.id||null;
}

export default function HVV(){
  const[screen,setScreen]=useState("loading");
  const[user,setUser]=useState(null);
  const[apiKey,setApiKey]=useState("");
  const[form,setForm]=useState(null);
  const[pacienteId,setPacienteId]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){
        const u={userId:session.user.id,email:session.user.email,name:session.user.user_metadata?.name||session.user.email.split("@")[0]};
        setUser(u);
        const pid=await getPacienteId(session.user.id);
        if(pid){
          setPacienteId(pid);
          const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
          if(perfil && perfil.hvv_onboarding_completo===true){setForm(perfil);setScreen("apikey");}
          else setScreen("apikey");
        }else{
          setScreen("apikey");
        }
      }else{
        setScreen("login");
      }
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setUser(null);setForm(null);setPacienteId(null);setApiKey("");setScreen("login");}
    });
    return()=>subscription.unsubscribe();
  },[]);

  const handleLogin=async(userData)=>{
    setUser(userData);
    let pid=await getPacienteId(userData.userId);
    if(!pid){
      try{
        const{data:medico}=await supabase.from("medicos").select("id").limit(1).maybeSingle();
        const{data:novoPac}=await supabase.from("pacientes").insert({
          user_id:userData.userId,
          medico_id:medico?.id||"c0618c54-a555-4781-8e91-075f8898e54a",
          nome:userData.name,email:userData.email,
          plano:"Essential",
        }).select("id").single();
        if(novoPac)pid=novoPac.id;
      }catch(e){console.warn("Erro ao criar paciente:",e);}
    }
    if(pid){
      setPacienteId(pid);
      const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).maybeSingle();
      if(perfil){setForm(perfil);setScreen("apikey");}
      else{setForm(null);setScreen("apikey");}
    }else{
      setForm(null);setScreen("apikey");
    }
  };

  const handleApiKey=async(key)=>{
    setApiKey(key);
    if(user){
      const pid=await getPacienteId(user.userId);
      if(pid){
        setPacienteId(pid);
        const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
        // Só vai para o app se o onboarding HVV foi completado
        if(perfil && perfil.hvv_onboarding_completo===true){
          setForm(perfil);setScreen("app");return;
        }
      }
    }
    // Qualquer outro caso — novo usuário ou onboarding pendente — vai para boas-vindas
    setScreen("boasvindas");
  };

  const handleOnboarding=async(f)=>{
    setForm(f);
    setScreen("processing");
    let pid=pacienteId;
    if(!pid&&user){
      pid=await getPacienteId(user.userId);
      if(pid)setPacienteId(pid);
    }
    if(pid){
      try{
        await supabase.from("perfis").upsert({paciente_id:pid,...f,hvv_onboarding_completo:true},{onConflict:"paciente_id"});
        await supabase.from("pacientes").update({nome:f.nome,cargo:f.cargo||""}).eq("id",pid);
      }catch(e){console.error("Erro ao salvar perfil:",e);}
    }
    setTimeout(()=>setScreen("app"),2800);
  };

  const handleReset=async()=>{
    // Limpa flag de onboarding — usuário passa pelo fluxo novamente
    if(pacienteId){
      await supabase.from("perfis").update({hvv_onboarding_completo:false}).eq("paciente_id",pacienteId);
    }
    setForm(null);
    setScreen("boasvindas");
  };

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    setUser(null);setForm(null);setPacienteId(null);setApiKey("");setScreen("login");
  };

  if(screen==="loading")return(
    <div style={{minHeight:"100vh",background:"#F7F6F2",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:48,height:48,borderRadius:12,background:"#00A868",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:22}}>V</div>
    </div>
  );

  return(
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} textarea{resize:none} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#C7E6D0;border-radius:2px} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:0.4;transform:scale(0.9)}50%{opacity:1;transform:scale(1.05)}} @keyframes blink{0%,100%{opacity:0.2}50%{opacity:1}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {screen==="login"      && <ScreenLogin onLogin={handleLogin}/>}
      {screen==="apikey"     && <ScreenApiKey user={user} onConfirm={handleApiKey} onReset={handleReset}/>}
      {screen==="boasvindas" && <ScreenBoasVindas onStart={()=>setScreen("onboarding")}/>}
      {screen==="onboarding" && <ScreenOnboarding user={user} onComplete={handleOnboarding}/>}
      {screen==="processing" && <ScreenProcessing/>}
      {screen==="app"        && <AppPrincipal user={user} form={form} apiKey={apiKey} pacienteId={pacienteId} onLogout={handleLogout}/>}
    </>
  );
}
