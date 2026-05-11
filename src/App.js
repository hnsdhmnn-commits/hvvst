import React, { useState, useEffect } from "react";
import { T, supabase, Btn, Input, Avatar, Card, Spinner, buildPrompt,
  ScreenLogin, ScreenApiKey, ScreenBoasVindas, ScreenOnboarding,
  ScreenProcessing, AppPrincipal } from './Components';

async function getPacienteId(userId){
  const{data}=await supabase.from("pacientes").select("id").eq("user_id",userId).maybeSingle();
  return data?.id||null;
}

async function getModulosContratados(pacienteId){
  if(!pacienteId)return["bloom"];
  const{data,error}=await supabase.from("v_paciente_modulos").select("modulos_efetivos").eq("paciente_id",pacienteId).maybeSingle();
  if(error||!data)return["bloom"];
  console.log("[CHEVO MASTER] modulos efetivos:",data.modulos_efetivos);
  return data.modulos_efetivos||["bloom"];
}

export default function HVV(){
  const[screen,setScreen]=useState("loading");
  const[user,setUser]=useState(null);
  const[apiKey,setApiKey]=useState(()=>localStorage.getItem("hvv_api_key")||"");
  const[form,setForm]=useState(null);
  const[pacienteId,setPacienteId]=useState(null);
  const[modulosContratados,setModulosContratados]=useState(["bloom"]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){
        const u={userId:session.user.id,email:session.user.email,name:session.user.user_metadata?.name||session.user.email.split("@")[0]};
        setUser(u);
        const pid=await getPacienteId(session.user.id);
        if(pid){
          setPacienteId(pid);
          getModulosContratados(pid).then(setModulosContratados);
          const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
          const{data:pac}=await supabase.from("pacientes").select("nome").eq("id",pid).single();
          const perfilComNome=perfil?{...perfil,nome:pac?.nome||perfil.nome}:perfil;
          const chaveSalva=localStorage.getItem("hvv_api_key")||"";
          if(perfilComNome && perfilComNome.hvv_onboarding_completo===true && chaveSalva.startsWith("sk-")){
            setForm(perfilComNome);setApiKey(chaveSalva);setScreen("app");
          } else if(perfilComNome && perfilComNome.hvv_onboarding_completo===true){
            setForm(perfilComNome);setScreen("apikey");
          } else {
            setScreen("apikey");
          }
        }else{
          setScreen("apikey");
        }
      }else{
        setScreen("login");
      }
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setUser(null);setForm(null);setPacienteId(null);setModulosContratados(["bloom"]);setApiKey("");setScreen("login");}
    });
    return()=>subscription.unsubscribe();
  },[]);

  const handleLogin=async(userData)=>{
    setUser(userData);

    // Verificar se é médico — médicos não podem entrar no app colaborador
    const{data:ehMedico}=await supabase.from("medicos")
      .select("id").eq("email",userData.email).maybeSingle();
    if(ehMedico){
      await supabase.auth.signOut();
      setUser(null);setScreen("login");
      alert("Este e-mail está cadastrado como médico. Acesse o app médico em hvvmedico.netlify.app");
      return;
    }

    let pid=await getPacienteId(userData.userId);

    if(!pid){
      // Verificar se o e-mail está pré-cadastrado pelo admin
      const{data:pacientePrecadastrado}=await supabase.from("pacientes")
        .select("id,nome,medico_id")
        .eq("email",userData.email)
        .is("user_id",null)
        .maybeSingle();

      if(pacientePrecadastrado){
        // Vincular user_id ao paciente pré-cadastrado
        await supabase.from("pacientes").update({
          user_id:userData.userId,
          nome:pacientePrecadastrado.nome||userData.name,
        }).eq("id",pacientePrecadastrado.id);
        pid=pacientePrecadastrado.id;
      } else {
        // E-mail não autorizado — fazer logout e mostrar erro
        await supabase.auth.signOut();
        setUser(null);setScreen("login");
        alert("Acesso não autorizado. Solicite seu cadastro ao RH ou ao administrador do sistema.");
        return;
      }
    }
    if(pid){
      setPacienteId(pid);
      getModulosContratados(pid).then(setModulosContratados);
      const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).maybeSingle();
      const{data:pac2}=await supabase.from("pacientes").select("nome").eq("id",pid).single();
      const perfilComNome=perfil?{...perfil,nome:pac2?.nome||perfil.nome}:perfil;
      const chaveSalva=localStorage.getItem("hvv_api_key")||"";
      if(perfilComNome && perfilComNome.hvv_onboarding_completo===true && chaveSalva.startsWith("sk-")){
        setForm(perfilComNome);setApiKey(chaveSalva);setScreen("app");
      } else if(perfilComNome){
        setForm(perfilComNome);setScreen("apikey");
      } else {
        setForm(null);setScreen("apikey");
      }
    }else{
      setForm(null);setScreen("apikey");
    }
  };

  const handleApiKey=async(key)=>{
    setApiKey(key);
    localStorage.setItem("hvv_api_key", key);
    if(user){
      const pid=await getPacienteId(user.userId);
      if(pid){
        setPacienteId(pid);
        getModulosContratados(pid).then(setModulosContratados);
        const{data:perfil}=await supabase.from("perfis").select("*").eq("paciente_id",pid).single();
        const{data:pac3}=await supabase.from("pacientes").select("nome").eq("id",pid).single();
        const perfilComNome=perfil?{...perfil,nome:pac3?.nome||perfil.nome}:perfil;
        // Só vai para o app se o onboarding HVV foi completado
        if(perfilComNome && perfilComNome.hvv_onboarding_completo===true){
          setForm(perfilComNome);setScreen("app");return;
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
      if(pid){
        setPacienteId(pid);
        getModulosContratados(pid).then(setModulosContratados);
      }
    }
    if(pid){
      try{
        // Salvar apenas campos confirmados na tabela perfis
        const perfil={
          paciente_id:pid,
          hvv_onboarding_completo:true,
          hvv_onboarding_data:new Date().toISOString(),
          // Identidade
          idade:f.idade?Number(f.idade):null,
          peso:f.peso?Number(f.peso):null,
          altura:f.altura?Number(f.altura):null,
          horas_trab:f.horas_trab?Number(f.horas_trab):null,
          horas_descanso:f.horas_descanso?Number(f.horas_descanso):null,
          // Saúde atual
          condicoes:f.condicoes||[],
          condicao_outro:f.condicao_outro||null,
          meds:f.meds||[],
          med_outro:f.med_outro||null,
          alergia_med:f.alergia_med||null,
          energia:f.energia?Number(f.energia):null,
          qualidade_vida:f.qualidade_vida?Number(f.qualidade_vida):null,
          sintomas:f.sintomas||[],
          sintoma_outro:f.sintoma_outro||null,
          // Histórico
          hist_cardio_fam:f.hist_cardio_fam||null,
          hist_cancer_fam:f.hist_cancer_fam||null,
          hist_diabetes_fam:f.hist_diabetes_fam||null,
          hist_depressao_fam:f.hist_depressao_fam||null,
          cirurgias:f.cirurgias||null,
          hospitalizacoes:f.hospitalizacoes||null,
          // Exames
          colesterol_total:f.colesterol_total?Number(f.colesterol_total):null,
          colesterol_ldl:f.colesterol_ldl?Number(f.colesterol_ldl):null,
          colesterol_hdl:f.colesterol_hdl?Number(f.colesterol_hdl):null,
          triglicerides:f.triglicerides?Number(f.triglicerides):null,
          glicose_jejum:f.glicose_jejum?Number(f.glicose_jejum):null,
          hemoglobina_glicada:f.hemoglobina_glicada?Number(f.hemoglobina_glicada):null,
          pressao_sistolica:f.pressao_sistolica?Number(f.pressao_sistolica):null,
          pressao_diastolica:f.pressao_diastolica?Number(f.pressao_diastolica):null,
          // Estilo de vida
          sono:f.sono?Number(f.sono):null,
          qual_sono:f.qual_sono?Number(f.qual_sono):null,
          exercicios:f.exercicios||[],
          exercicio_outro:f.exercicio_outro||null,
          freq_treino:f.freq_treino?Number(f.freq_treino):null,
          alcool:f.alcool||null,
          estresse:f.estresse?Number(f.estresse):null,
          meditacao:f.meditacao!=null?Number(f.meditacao):null,
          dieta:f.dieta||null,
          tabaco:f.tabaco||null,
          // Objetivos
          metas:f.metas||[],
          disponibilidade:f.disponibilidade?Number(f.disponibilidade):null,
          acompanhamento:f.acompanhamento||null,
          horizonte:f.horizonte||null,
          // Gadgets
          gadgets:f.gadgets||[],
          gadget_outro:f.gadget_outro||null,
          // Rede de apoio
          estado_civil:f.estado_civil||null,
          filhos:f.filhos||null,
          qualidade_rede:f.qualidade_rede?Number(f.qualidade_rede):null,
          satisfacao_social:f.satisfacao_social?Number(f.satisfacao_social):null,
          freq_social:f.freq_social||null,
        };
        const{error:perfilError}=await supabase.from("perfis").upsert(perfil,{onConflict:"paciente_id"});
        if(perfilError)console.error("Erro ao salvar perfil:",perfilError);
        // Nome e cargo ficam na tabela pacientes
        if(f.nome)await supabase.from("pacientes").update({nome:f.nome,cargo:f.cargo||""}).eq("id",pid);
        // Gerar plano de cuidado inicial automaticamente
        const chave=localStorage.getItem("hvv_api_key")||apiKey||"";
        if(chave.startsWith("sk-")){
          const{data:planoExistente}=await supabase.from("plano_cuidado").select("id").eq("paciente_id",pid).eq("ativo",true).limit(1);
          if(!planoExistente||planoExistente.length===0){
            // Só gera se não tiver plano ainda
            const prompt=`Você é Ana, enfermeira do HVV. Gere um plano de cuidado inicial em JSON para este paciente.

PERFIL:
- Condições: ${(f.condicoes||[]).filter(c=>c!=="Nenhuma").join(", ")||"nenhuma"}
- Medicamentos: ${(f.meds||[]).filter(m=>m!=="Nenhum").join(", ")||"nenhum"}
- Sono: ${f.sono||7}h, qualidade ${f.qual_sono||5}/10
- Estresse: ${f.estresse||5}/10
- Treino: ${f.freq_treino||0}x/semana
- Dieta: ${f.dieta||"não informada"}
- Rede de apoio: ${f.qualidade_rede||"-"}/10
- Vida social: ${f.satisfacao_social||"-"}/10

Retorne APENAS um array JSON com 6-8 tarefas:
[{"area":"saude_geral|nutricao|atividade|emocional|vinculos|prevencao","titulo":"...","descricao":"...","frequencia":"diario","frequencia_tipo":"diario|n_vezes_semana|uma_vez_semana|uma_vez_mes|unico","meta_semanal":1,"ordem":1}]`;
            try{
              const res=await fetch("/.netlify/functions/claude",{
                method:"POST",
                headers:{"Content-Type":"application/json","x-api-key":chave,"anthropic-version":"2023-06-01"},
                body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:prompt}]})
              });
              const data=await res.json();
              const text=data.content?.[0]?.text||"[]";
              const tarefas=JSON.parse(text.replace(/```json|```/g,"").trim());
              if(tarefas.length>0){
                await supabase.from("plano_cuidado").insert(
                  tarefas.map(t=>({...t,paciente_id:pid,origem:"ia",ativo:true}))
                );
              }
            }catch(e){console.warn("Plano não gerado automaticamente:",e);}
          }
        }
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
    localStorage.removeItem("hvv_api_key");
    setUser(null);setForm(null);setPacienteId(null);setModulosContratados(["bloom"]);setApiKey("");setScreen("login");
  };

  if(screen==="loading")return(
    <div style={{minHeight:"100vh",background:"#F7F6F2",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:48,height:48,borderRadius:12,background:"#00A868",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:22}}>V</div>
    </div>
  );

  return(
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} textarea{resize:none} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#C7E6D0;border-radius:2px} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:0.4;transform:scale(0.9)}50%{opacity:1;transform:scale(1.05)}} @keyframes blink{0%,100%{opacity:0.2}50%{opacity:1}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes flor-respira{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}`}</style>
      {screen==="login"      && <ScreenLogin onLogin={handleLogin}/>}
      {screen==="apikey"     && <ScreenApiKey user={user} onConfirm={handleApiKey} onReset={handleReset}/>}
      {screen==="boasvindas" && <ScreenBoasVindas onStart={()=>setScreen("onboarding")}/>}
      {screen==="onboarding" && <ScreenOnboarding user={user} onComplete={handleOnboarding}/>}
      {screen==="processing" && <ScreenProcessing/>}
      {screen==="app"        && <AppPrincipal user={user} form={form} apiKey={apiKey} pacienteId={pacienteId} modulosContratados={modulosContratados} onLogout={handleLogout}/>}
    </>
  );
}
