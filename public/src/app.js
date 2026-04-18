import React, { useState } from "react";
import { T, AXIS_COLORS, EQUIPE, MODULOS, supabase, Btn, Input, Avatar, Card, Spinner, buildPrompt, ScreenLogin, ScreenApiKey, ScreenBoasVindas, ScreenOnboarding, ScreenProcessing, AppPrincipal } from './Components';

export default function HVV(){
  const[screen,setScreen]=useState("loading");
  const[user,setUser]=useState(null);
  const[apiKey,setApiKey]=useState("");
  const[form,setForm]=useState(null);
  const[pacienteId,setPacienteId]=useState(null);

  // Verificar sessão existente
  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){
        const u={userId:session.user.id,email:session.user.email,name:session.user.user_metadata?.name||session.user.email.split("@")[0]};
        setUser(u);
        // Carregar perfil
        const pid=await getPacienteId(session.user.id);
        if(pid){
          setPacienteId(pid);
          const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
          if(perfil){setForm(perfil);setScreen("apikey");}
          else setScreen("apikey");
        }else{
          setScreen("apikey");
        }
      }else{
        setScreen("login");
      }
    });
    // Escutar mudanças de auth
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setUser(null);setForm(null);setPacienteId(null);setApiKey("");setScreen("login");}
    });
    return()=>subscription.unsubscribe();
  },[]);

  const handleLogin=async(userData)=>{
    setUser(userData);
    let pid=await getPacienteId(userData.userId);
    // Se não tem paciente, criar automaticamente
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
      }catch(e){console.warn("Erro ao criar paciente no login:",e);}
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
    // Recarregar pacienteId e perfil com a chave já definida
    if(user){
      const pid=await getPacienteId(user.userId);
      if(pid){
        setPacienteId(pid);
        const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
        if(perfil){setForm(perfil);setScreen("app");return;}
      }
    }
    setScreen("boasvindas");
  };

  const handleOnboarding=async(f)=>{
    setForm(f);
    setScreen("processing");
    // Garantir que temos o pacienteId mais atualizado
    let pid=pacienteId;
    if(!pid&&user){
      pid=await getPacienteId(user.userId);
      if(pid)setPacienteId(pid);
    }
    if(pid){
      try{
        const perfilData={paciente_id:pid,...f};
        await supabase.from("perfis").upsert(perfilData,{onConflict:"paciente_id"});
        await supabase.from("pacientes").update({nome:f.nome,cargo:f.cargo||""}).eq("id",pid);
      }catch(e){console.error("Erro ao salvar perfil:",e);}
    }
    setTimeout(()=>setScreen("app"),2800);
  };

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    setUser(null);setForm(null);setPacienteId(null);setApiKey("");setScreen("login");
  };

  if(screen==="loading")return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fB}}><div style={{fontFamily:T.fD,fontSize:52,color:T.gold,animation:"pulse 2s ease infinite"}}>H</div></div>;

  return(
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} textarea{resize:none} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#D4CCBC;border-radius:2px} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:0.4;transform:scale(0.9)}50%{opacity:1;transform:scale(1.05)}} @keyframes blink{0%,100%{opacity:0.2}50%{opacity:1}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {screen==="login"      && <ScreenLogin onLogin={handleLogin}/>}
      {screen==="apikey"     && <ScreenApiKey user={user} onConfirm={handleApiKey}/>}
      {screen==="boasvindas" && <ScreenBoasVindas onStart={()=>setScreen("onboarding")}/>}
      {screen==="onboarding" && <ScreenOnboarding user={user} onComplete={handleOnboarding}/>}
      {screen==="processing" && <ScreenProcessing/>}
      {screen==="app"        && <AppPrincipal user={user} form={form} apiKey={apiKey} pacienteId={pacienteId} onLogout={handleLogout}/>}
    </>
  );
}
