import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ahznewkkcyakkilaatas.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoem5ld2trY3lha2tpbGFhdGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTQzMTIsImV4cCI6MjA5MTg3MDMxMn0.4nFFkuhRTNCXFnkSQDjc_JNi0yoHUBUfT4mgcQ2-3ak";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Data local (resolve problema de fuso UTC vs Brasília) ────────
function dataHoje(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function horaAgora(){
  const d=new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}



// ─── Design Tokens ────────────────────────────────────────────────
export const T = {
  bg:"#F7F6F2",bgWarm:"#FAFAF7",surface:"#FFFFFF",
  surfaceMid:"#F1EFE8",surfaceHi:"#E8F5EE",
  border:"#D0E8D8",borderMid:"#A8D4B8",
  shadowCard:"0 2px 8px rgba(0,100,60,0.07)",
  shadowHover:"0 4px 16px rgba(0,100,60,0.12)",
  ink:"#1B2A1E",inkMid:"#3A4A3E",inkLight:"#6A7A6E",inkFaint:"#A8B8AE",
  gold:"#00A868",goldFaint:"#E8F5EE",goldBorder:"#C7E6D0",
  teal:"#00875A",tealBg:"#E0F2EA",
  green:"#00A868",greenBg:"#E8F5EE",
  red:"#C0392B",redBg:"#FBEAEA",
  purple:"#5C7AEA",purpleBg:"#EEF2FD",
  blue:"#1A6B8A",blueBg:"#E8F4FA",
  orange:"#E07020",orangeBg:"#FEF3E8",
  fD:"'DM Sans',system-ui,sans-serif",
  fB:"'DM Mono','Courier New',monospace",
};

export const AXIS_COLORS={"Sono":T.purple,"Energia":T.teal,"Estresse":T.red,"Humor":T.gold,"Vínculos":T.blue,"Bem-estar":T.green};

export const EQUIPE=[
  {id:"enfermeira",nome:"Ana",titulo:"Enfermeira Coordenadora",cor:T.teal,bg:T.tealBg,icon:"🩺",descricao:"Coordena seu plano integral, motivação e acompanhamento MEV."},
  {id:"nutri",nome:"Dra. Lucia",titulo:"Nutricionista Clínica",cor:T.gold,bg:T.goldFaint,icon:"🥗",descricao:"Orientação nutricional, dieta e suplementação personalizada."},
  {id:"personal",nome:"Bruno",titulo:"Especialista em Atividade Física",cor:T.orange,bg:T.orangeBg,icon:"🏋️",descricao:"Treino, atividade física e recuperação baseados no seu perfil."},
  {id:"farmaceutico",nome:"Rafael",titulo:"Farmacêutico Clínico",cor:T.green,bg:T.greenBg,icon:"💊",descricao:"Medicamentos, interações e posologia. Alerta o seu médico pessoal em caso de risco."},
];

export function Spinner(){return <div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.green}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>;};

export const MODULOS=[
  {id:"dashboard",label:"Painel",icon:"◈"},
  {id:"plano",label:"Plano de Cuidado",icon:"📋",membro:"enfermeira"},
  {id:"ana",label:"Falar com Ana",icon:"🩺",membro:"enfermeira"},
  {id:"nutri",label:"Nutrição",icon:"🥗",membro:"nutri"},
  {id:"personal",label:"Atividade Física",icon:"🏋️",membro:"personal"},
  {id:"farmaceutico",label:"Farmácia",icon:"💊",membro:"farmaceutico"},
  {id:"documentos",label:"Documentos",icon:"📄"},
  {id:"mensagens",label:"Mensagens",icon:"💬"},
  {id:"integracoes",label:"Integrações",icon:"🔗"},
];

// ─── Score ────────────────────────────────────────────────────────
function calcScores(form,checkin){
  const f=form;

  // Valores padrão quando não há perfil
  if(!f)return{eixos:{"Sono":70,"Energia":70,"Estresse":60,"Humor":70,"Vínculos":65,"Bem-estar":70},total:68};

  // ── Base do perfil (dados do onboarding) ──────────────────────
  // Sono: horas + qualidade declarada
  let sono=Math.min(100,
    (Number(f.sono)>=8?85:Number(f.sono)>=7?75:Number(f.sono)>=6?60:40)
    +(Number(f.qual_sono)||5)*1.5
  );

  // Energia: proxy via freq_treino e horas de trabalho
  let energia=Math.min(100,
    40+(Number(f.freq_treino)||0)*8
    -(Number(f.horas_trab)>60?10:0)
    +(Number(f.horas_descanso)||2)*3
  );

  // Estresse: invertido — estresse alto = score baixo
  let estresse=Math.max(10,
    100-(Number(f.estresse)||5)*9
    +(f.meditacao>=1?8:0)
    -(Number(f.horas_trab)>55?5:0)
  );

  // Humor: proxy via qualidade de vida declarada
  let humor=Math.min(100,
    (Number(f.qualidade_vida)||6)*9
    +({Mediterrâneo:5,"Low-carb":3,Vegetariano:4,Vegano:4}[f.dieta]||0)
  );

  // Vínculos: rede de apoio e satisfação social do perfil
  let vinculos=Math.min(100,
    (Number(f.qualidade_rede)||5)*7
    +(Number(f.satisfacao_social)||5)*5
    -(Number(f.horas_trab)>60?8:0)
  );

  // Bem-estar: combinação de múltiplos fatores
  let bemestar=Math.min(100,
    (Number(f.qualidade_vida)||6)*8
    +{"Nunca":8,"Ocasional":4,"Semanal":-2,"Diário":-12}[f.alcool||"Ocasional"]
    +(f.tabaco==="Nunca"||!f.tabaco?5:-10)
  );

  const s={
    "Sono": Math.round(Math.max(0,Math.min(100,sono))),
    "Energia": Math.round(Math.max(0,Math.min(100,energia))),
    "Estresse": Math.round(Math.max(0,Math.min(100,estresse))),
    "Humor": Math.round(Math.max(0,Math.min(100,humor))),
    "Vínculos": Math.round(Math.max(0,Math.min(100,vinculos))),
    "Bem-estar": Math.round(Math.max(0,Math.min(100,bemestar))),
  };

  // ── Check-in do dia sobrescreve com peso maior ─────────────────
  // Dados reais do check-in têm prioridade sobre estimativas do perfil
  if(checkin){
    // Sono: check-in tem peso 70%, perfil 30%
    if(checkin.sono)
      s["Sono"]=Math.round(Math.max(0,Math.min(100,
        s["Sono"]*0.3 + Number(checkin.sono)*10*0.7
      )));

    // Energia: check-in tem peso 80%
    if(checkin.energia)
      s["Energia"]=Math.round(Math.max(0,Math.min(100,
        s["Energia"]*0.2 + Number(checkin.energia)*10*0.8
      )));

    // Estresse: check-in invertido — estresse 8/10 = score 20
    if(checkin.estresse)
      s["Estresse"]=Math.round(Math.max(0,Math.min(100,
        s["Estresse"]*0.3 + (10-Number(checkin.estresse))*10*0.7
      )));

    // Humor: check-in tem peso 80%
    if(checkin.humor)
      s["Humor"]=Math.round(Math.max(0,Math.min(100,
        s["Humor"]*0.2 + Number(checkin.humor)*10*0.8
      )));

    // Vínculos: média dos sub-eixos do check-in quando disponíveis
    const subVinculos=[checkin.rede_apoio,checkin.relacoes_colegas,checkin.relacoes_lider,checkin.vida_social,checkin.relacionamentos_pessoais].filter(Boolean);
    if(subVinculos.length>0){
      const mediaVinculos=subVinculos.reduce((a,b)=>a+Number(b),0)/subVinculos.length;
      s["Vínculos"]=Math.round(Math.max(0,Math.min(100,
        s["Vínculos"]*0.2 + mediaVinculos*10*0.8
      )));
    } else if(checkin.vinculos){
      s["Vínculos"]=Math.round(Math.max(0,Math.min(100,
        s["Vínculos"]*0.2 + Number(checkin.vinculos)*10*0.8
      )));
    }

    // Bem-estar: check-in tem peso 80%
    if(checkin.bem_estar)
      s["Bem-estar"]=Math.round(Math.max(0,Math.min(100,
        s["Bem-estar"]*0.2 + Number(checkin.bem_estar)*10*0.8
      )));
  }

  const total=Math.round(Object.values(s).reduce((a,b)=>a+b,0)/Object.keys(s).length);
  return{eixos:s,total};
}

// ─── Supabase Helpers ─────────────────────────────────────────────
async function getPacienteId(userId){
  const{data}=await supabase.from("pacientes").select("id").eq("user_id",userId).single();
  return data?.id;
}

async function salvarCheckinDB(pacienteId,dados){
  const{error}=await supabase.from("checkins").upsert({
    paciente_id:pacienteId,
    data:dataHoje(),
    hora:horaAgora(),
    sono:dados.sono,
    energia:dados.energia,
    estresse:dados.estresse,
    humor:dados.humor,
    vinculos:dados.vinculos,
    bem_estar:dados.bem_estar,
    rede_apoio:dados.rede_apoio,
    relacoes_colegas:dados.relacoes_colegas,
    relacoes_lider:dados.relacoes_lider,
    vida_social:dados.vida_social,
    relacionamentos_pessoais:dados.relacionamentos_pessoais,
    sintomas:dados.sintomas,
    notas:dados.notas,
  },{onConflict:"paciente_id,data"});
  return!error;
}

// ─── Plano de Cuidado — Banco ─────────────────────────────────────
async function carregarPlanoCuidado(pacienteId){
  const{data}=await supabase.from("plano_cuidado")
    .select("*")
    .eq("paciente_id",pacienteId)
    .eq("ativo",true)
    .order("area").order("ordem");
  return data||[];
}

async function carregarRegistrosHoje(pacienteId){
  // Buscar registros dos últimos 31 dias para cobrir todas as frequências
  const d=new Date();
  const inicio=new Date(d);
  inicio.setDate(inicio.getDate()-31);
  const inicioStr=`${inicio.getFullYear()}-${String(inicio.getMonth()+1).padStart(2,'0')}-${String(inicio.getDate()).padStart(2,'0')}`;
  const{data}=await supabase.from("plano_registros")
    .select("*")
    .eq("paciente_id",pacienteId)
    .gte("data",inicioStr)
    .eq("status","concluido")
    .order("data",{ascending:false});
  return data||[];
}

async function registrarTarefa(tarefaId,pacienteId,status){
  const hoje=dataHoje();
  const{error}=await supabase.from("plano_registros").upsert({
    tarefa_id:tarefaId,
    paciente_id:pacienteId,
    data:hoje,
    status,
  },{onConflict:"tarefa_id,data"});
  return!error;
}

// ─── Programas ────────────────────────────────────────────────────
async function carregarProgramas(empresaId){
  const{data}=await supabase.from("programas")
    .select("*")
    .eq("empresa_id",empresaId)
    .eq("ativo",true)
    .order("ordem");
  return data||[];
}

async function carregarInscricoes(pacienteId){
  const{data}=await supabase.from("inscricoes_programas")
    .select("*,programas(*),medicos(id,nome,especialidade,foto_url)")
    .eq("paciente_id",pacienteId)
    .eq("status","ativo");
  return data||[];
}

async function inscreverPrograma(pacienteId,programaId,medicoId){
  const{error}=await supabase.from("inscricoes_programas").upsert({
    paciente_id:pacienteId,
    programa_id:programaId,
    medico_id:medicoId||null,
    status:"ativo",
  },{onConflict:"paciente_id,programa_id"});
  return!error;
}

async function carregarMedicos(){
  const{data}=await supabase.from("medicos").select("id,nome,especialidade,foto_url").eq("ativo",true);
  return data||[];
}

// ─── Programas ────────────────────────────────────────────────────
async function carregarProgramas(empresaId){
  const{data}=await supabase.from("programas")
    .select("*")
    .eq("empresa_id",empresaId)
    .eq("ativo",true)
    .order("ordem");
  return data||[];
}

async function carregarInscricoes(pacienteId){
  const{data}=await supabase.from("inscricoes_programas")
    .select("*,programas(*),medicos(id,nome,crm,especialidade)")
    .eq("paciente_id",pacienteId)
    .eq("status","ativo");
  return data||[];
}

async function inscreverPrograma(pacienteId,programaId,medicoId){
  const{error}=await supabase.from("inscricoes_programas").upsert({
    paciente_id:pacienteId,
    programa_id:programaId,
    medico_id:medicoId||null,
    status:"ativo",
  },{onConflict:"paciente_id,programa_id"});
  return!error;
}

async function carregarMedicos(){
  const{data}=await supabase.from("medicos").select("id,nome,crm,especialidade").eq("ativo",true);
  return data||[];
}

async function gerarPlanoInicial(pacienteId,form,apiKey){
  // Gera tarefas iniciais via IA com base no perfil
  const prompt=`Você é Ana, enfermeira coordenadora do HVV. Com base no perfil abaixo, gere um plano de cuidado inicial com tarefas concretas em JSON.

PERFIL:
- Condições: ${(form?.condicoes||[]).filter(c=>c!=="Nenhuma").join(", ")||"nenhuma"}
- Medicamentos: ${(form?.meds||[]).filter(m=>m!=="Nenhum").join(", ")||"nenhum"}
- Sono: ${form?.sono||7}h, qualidade ${form?.qual_sono||5}/10
- Estresse: ${form?.estresse||5}/10
- Exercícios: ${form?.freq_treino||0}x/semana
- Dieta: ${form?.dieta||"não informado"}
- Rede de apoio: ${form?.qualidade_rede||"-"}/10
- Vida social: ${form?.satisfacao_social||"-"}/10

Retorne APENAS um array JSON com 6-10 tarefas no formato:
[{"area":"saude_geral|nutricao|atividade|emocional|vinculos|prevencao","titulo":"...","descricao":"...","frequencia":"diario","frequencia_tipo":"diario|n_vezes_semana|uma_vez_semana|uma_vez_mes|unico","meta_semanal":3,"ordem":1}]

Regras para frequencia_tipo:
- "diario": tarefas que devem ser feitas todo dia (tomar medicamento, beber água, etc)
- "n_vezes_semana": atividades com meta semanal — use meta_semanal para definir quantas vezes (ex: exercício 3x/semana = meta_semanal:3)
- "uma_vez_semana": tarefas semanais (ex: pesar na balança, revisar plano)
- "uma_vez_mes": tarefas mensais (ex: consulta de retorno, exame)
- "unico": tarefas pontuais que some quando concluída (ex: agendar consulta, comprar medicamento)`;

  try{
    const chave=apiKey||localStorage.getItem("hvv_api_key")||"";
    const res=await fetch("/.netlify/functions/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":chave,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:prompt}]})
    });
    const data=await res.json();
    const text=data.content?.[0]?.text||"[]";
    const clean=text.replace(/```json|```/g,"").trim();
    const tarefas=JSON.parse(clean);
    // Salvar no banco
    const inserts=tarefas.map(t=>({...t,paciente_id:pacienteId,origem:"ia",ativo:true}));
    await supabase.from("plano_cuidado").insert(inserts);
    return inserts;
  }catch(e){
    console.error("Erro ao gerar plano:",e);
    return[];
  }
}

async function carregarCheckinHoje(pacienteId){
  const hoje=dataHoje();
  const{data}=await supabase.from("checkins").select("*")
    .eq("paciente_id",pacienteId)
    .eq("data",hoje)
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  return data;
}

async function salvarPlanLog(pacienteId,evento){
  await supabase.from("plano_log").insert({
    paciente_id:pacienteId,
    icon:evento.icon,cor:evento.cor,
    titulo:evento.titulo,descricao:evento.descricao,
    data:dataHoje(),
  });
}

async function carregarPlanLog(pacienteId){
  const{data}=await supabase.from("plano_log").select("*").eq("paciente_id",pacienteId).order("created_at",{ascending:false}).limit(20);
  return data||[];
}

async function salvarMensagemChat(pacienteId,membro,role,content){
  await supabase.from("chats").insert({paciente_id:pacienteId,membro,role,content});
}

async function carregarHistoricoChat(pacienteId,membro){
  const{data}=await supabase.from("chats").select("*").eq("paciente_id",pacienteId).eq("membro",membro).order("created_at",{ascending:true}).limit(50);
  return(data||[]).map(m=>({role:m.role,content:m.content}));
}

async function salvarDocumento(pacienteId,doc){
  const{data}=await supabase.from("documentos").insert({
    paciente_id:pacienteId,
    titulo:doc.titulo,tipo:doc.tipo,origem:"paciente",
    resumo:doc.resumo,conteudo_json:doc.analise,
    data:dataHoje(),
  }).select().single();
  return data;
}

async function carregarDocumentos(pacienteId){
  const{data}=await supabase.from("documentos").select("*").eq("paciente_id",pacienteId).order("created_at",{ascending:false});
  return data||[];
}

async function carregarMensagens(pacienteId){
  const{data}=await supabase.from("mensagens").select("*").eq("paciente_id",pacienteId).order("created_at",{ascending:true});
  return data||[];
}

async function marcarMensagensLidas(pacienteId){
  await supabase.from("mensagens").update({lida:true}).eq("paciente_id",pacienteId).eq("remetente","ana").eq("lida",false);
}

async function salvarAnaliseGenetica(pacienteId,analise,pdfNome){
  try{
    // Remover laudo genético anterior se existir
    await supabase.from("documentos")
      .delete()
      .eq("paciente_id",pacienteId)
      .eq("tipo","genetico");
    // Inserir novo
    const{error}=await supabase.from("documentos").insert({
      paciente_id:pacienteId,
      titulo:`Laudo Genético — ${pdfNome}`,
      tipo:"genetico",origem:"paciente",
      resumo:analise?.resumo||"",
      conteudo_json:{...analise,pdfNome},
      data:dataHoje(),
    });
    if(error)console.error("Erro ao salvar laudo:",error);
    else console.log("Laudo salvo com sucesso");
  }catch(e){console.error("Erro ao salvar laudo:",e);}
}

async function carregarAnaliseGenetica(pacienteId){
  try{
    const{data}=await supabase.from("documentos")
      .select("conteudo_json,titulo")
      .eq("paciente_id",pacienteId)
      .eq("tipo","genetico")
      .order("created_at",{ascending:false})
      .limit(1)
      .maybeSingle();
    if(!data)return null;
    return{analise:data.conteudo_json,pdfNome:data.conteudo_json?.pdfNome||data.titulo};
  }catch(e){
    console.log("Nenhum laudo salvo ainda");
    return null;
  }
}

// ─── UI Primitives ────────────────────────────────────────────────
function Lbl({children,color}){return <div style={{fontSize:9,letterSpacing:"0.18em",color:color||T.inkLight,textTransform:"uppercase",marginBottom:8,fontFamily:T.fB,fontWeight:600}}>{children}</div>;}
export function Card({children,style={},onClick,hover=false}){const[hov,setHov]=useState(false);return <div onClick={onClick} onMouseOver={()=>hover&&setHov(true)} onMouseOut={()=>hover&&setHov(false)} style={{background:T.surface,borderRadius:12,boxShadow:hov?T.shadowHover:T.shadowCard,border:`1px solid ${T.border}`,transition:"all 0.2s",cursor:onClick?"pointer":"default",...style}}>{children}</div>;}
export function Btn({children,onClick,variant="primary",disabled=false,style={}}){const v={primary:{background:T.ink,color:"#FFF",border:`1px solid ${T.ink}`},gold:{background:T.gold,color:"#FFF",border:`1px solid ${T.gold}`},outline:{background:"transparent",color:T.ink,border:`1px solid ${T.border}`},teal:{background:T.teal,color:"#FFF",border:`1px solid ${T.teal}`},ghost:{background:"transparent",color:T.inkLight,border:"none"}};return <button onClick={disabled?undefined:onClick} disabled={disabled} style={{padding:"11px 24px",borderRadius:8,fontFamily:T.fB,fontSize:11,letterSpacing:"0.16em",fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,transition:"all 0.2s",...v[variant],...style}}>{children}</button>;}
function TxtInput({label,placeholder,value,onChange,type="text",unit,autoFocus,error}){const[foc,setFoc]=useState(false);return <div>{label&&<Lbl>{label}</Lbl>}<div style={{position:"relative"}}><input autoFocus={autoFocus} type={type} placeholder={placeholder} value={value||""} onChange={e=>onChange(e.target.value)} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{width:"100%",background:T.bgWarm,border:`1.5px solid ${error?T.red:foc?T.gold:T.border}`,borderRadius:8,padding:unit?"11px 48px 11px 14px":"11px 14px",color:T.ink,fontFamily:T.fB,fontSize:13,outline:"none",transition:"border-color 0.2s",boxSizing:"border-box"}}/>{unit&&<span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:10,color:T.inkLight}}>{unit}</span>}</div>{error&&<div style={{fontSize:11,color:T.red,marginTop:4}}>{error}</div>}</div>;}
function SldInput({label,value,onChange,min,max,unit,color=T.gold,hint}){return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><Lbl>{label}</Lbl><span style={{fontSize:16,color,fontFamily:T.fD,fontWeight:700}}>{value}{unit}</span></div><input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%",accentColor:color,cursor:"pointer",height:4}}/><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:9,color:T.inkFaint}}>{hint||min}</span><span style={{fontSize:9,color:T.inkFaint}}>{max}</span></div></div>;}
function Chip({label,active,color=T.gold,bg,onClick}){return <button onClick={onClick} style={{padding:"8px 14px",borderRadius:6,cursor:"pointer",fontFamily:T.fB,fontSize:12,background:active?(bg||T.goldFaint):"transparent",border:`1.5px solid ${active?color:T.border}`,color:active?color:T.inkMid,transition:"all 0.18s"}}>{label}</button>;}
function RadialScore({value,size=100}){const r=size/2-9,circ=2*Math.PI*r,dash=(value/100)*circ,color=value>=75?T.green:value>=50?T.gold:T.red;return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.surfaceMid} strokeWidth="7"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dasharray 1.4s cubic-bezier(0.34,1.56,0.64,1)"}}/><text x={size/2} y={size/2-6} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="20" fontFamily="Georgia,serif" fontWeight="700">{value}</text><text x={size/2} y={size/2+14} textAnchor="middle" dominantBaseline="middle" fill={T.inkFaint} fontSize="9" fontFamily="'DM Mono',monospace">/100</text></svg>;}

// ─── ChatIA com persistência ──────────────────────────────────────
function ChatIA({membro,systemPrompt,apiKey,placeholder,sugestoes,inicialMsg,pdfB64,pacienteId}){
  const eq=EQUIPE.find(e=>e.id===membro);
  const[msgs,setMsgs]=useState([{role:"assistant",content:inicialMsg}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[carregando,setCarregando]=useState(true);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  // Carregar histórico do Supabase
  useEffect(()=>{
    if(!pacienteId){setCarregando(false);return;}
    // Pequeno delay para não conflitar com chamadas anteriores (ex: análise de PDF)
    const timer=setTimeout(()=>{
      carregarHistoricoChat(pacienteId,membro).then(hist=>{
        if(hist.length>0)setMsgs([{role:"assistant",content:inicialMsg},...hist]);
        setCarregando(false);
      }).catch(()=>setCarregando(false));
    },3000);
    return()=>clearTimeout(timer);
  },[pacienteId,membro]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async(text)=>{
    if(!text.trim()||loading||!apiKey)return;
    const userMsg={role:"user",content:text};
    setMsgs(prev=>[...prev,userMsg,{role:"assistant",content:"",loading:true}]);
    setInput("");setLoading(true);
    // Salvar mensagem do usuário no Supabase
    if(pacienteId)await salvarMensagemChat(pacienteId,membro,"user",text);
    // Se tem PDF, usar haiku e aguardar um pouco para evitar rate limit
    const modeloUsado="claude-sonnet-4-20250514";
    // PDF só é enviado se explicitamente passado (geneticista agora usa JSON)
    if(pdfB64)await new Promise(r=>setTimeout(r,1000));
    const enviarMensagem=async(tentativa=1)=>{
    try{
      const history=[...msgs,userMsg].filter(m=>!m.loading).map((m,i)=>{
        if(i===0&&pdfB64&&m.role==="user")return{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:pdfB64}},{type:"text",text:m.content}]};
        return{role:m.role,content:m.content};
      });
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:modeloUsado,max_tokens:900,system:systemPrompt,messages:history})});
      if(res.status===429&&tentativa<3){await new Promise(r=>setTimeout(r,3000*tentativa));return enviarMensagem(tentativa+1);}
      const data=await res.json();
      const resposta=data.content?.[0]?.text||"Erro ao processar.";
      setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:resposta}]);
      // Salvar resposta da IA no Supabase
      if(pacienteId)await salvarMensagemChat(pacienteId,membro,"assistant",resposta);
    }catch{
      setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Erro de conexão. Verifique sua API Key."}]);
    }finally{setLoading(false);setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);inputRef.current?.focus();}
  };
  await enviarMensagem();
  };

  if(carregando)return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:12,color:T.inkFaint}}>Carregando histórico...</div></div>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px 8px"}}>
        {msgs.map((msg,i)=>{const isUser=msg.role==="user";return(<div key={i} style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:12,marginBottom:20,alignItems:"flex-start"}}>{!isUser&&<div style={{width:36,height:36,borderRadius:"50%",background:eq?.bg||T.goldFaint,border:`1.5px solid ${eq?.cor||T.gold}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,marginTop:2}}>{eq?.icon||"◈"}</div>}<div style={{maxWidth:"74%",padding:"14px 18px",background:isUser?T.goldFaint:T.surface,border:`1px solid ${isUser?T.goldBorder:T.border}`,borderRadius:isUser?"16px 16px 4px 16px":"4px 16px 16px 16px",fontSize:13,color:T.ink,lineHeight:1.8,whiteSpace:"pre-wrap",boxShadow:T.shadowCard}}>{msg.loading?<span style={{display:"inline-flex",gap:5}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:"50%",background:eq?.cor||T.gold,display:"inline-block",animation:`blink 1.2s ease ${j*0.2}s infinite`}}/>)}</span>:msg.content}</div></div>);})}
        <div ref={bottomRef}/>
      </div>
      {msgs.length<=1&&sugestoes?.length>0&&(
        <div style={{padding:"0 28px 14px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
          {sugestoes.map((s,i)=>(<button key={i} onClick={()=>send(s)} style={{padding:"8px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,fontSize:12,color:T.inkMid,cursor:"pointer",fontFamily:T.fB,transition:"all 0.18s",boxShadow:T.shadowCard}} onMouseOver={e=>{e.currentTarget.style.borderColor=eq?.cor||T.gold;e.currentTarget.style.color=eq?.cor||T.gold;}} onMouseOut={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.inkMid;}}>{s}</button>))}
        </div>
      )}
      <div style={{padding:"6px 28px",background:T.surfaceMid,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{fontSize:10,color:T.inkFaint,lineHeight:1.6}}>⚠️ Respostas de IA — valide com o seu médico pessoal antes de decisões clínicas.</div>
      </div>
      <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 28px",display:"flex",gap:10,alignItems:"flex-end",flexShrink:0,background:T.bgWarm}}>
        <textarea ref={inputRef} rows={1} placeholder={apiKey?placeholder:"Configure a API Key..."} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}} disabled={loading||!apiKey} style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"12px 16px",color:T.ink,fontFamily:T.fB,fontSize:13,outline:"none",lineHeight:1.6,minHeight:44,maxHeight:120,overflow:"hidden",resize:"none",opacity:apiKey?1:0.5,boxShadow:T.shadowCard}}/>
        <button onClick={()=>send(input)} disabled={loading||!input.trim()||!apiKey} style={{width:44,height:44,borderRadius:10,background:(!loading&&input.trim()&&apiKey)?eq?.cor||T.gold:"transparent",border:`1.5px solid ${(!loading&&input.trim()&&apiKey)?eq?.cor||T.gold:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:(!loading&&input.trim()&&apiKey)?"#FFF":T.inkFaint,transition:"all 0.2s",flexShrink:0,fontWeight:700}}>{loading?"…":"↑"}</button>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────
export function ScreenLogin({onLogin}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");const[pass,setPass]=useState("");const[name,setName]=useState("");
  const[err,setErr]=useState("");const[loading,setLoading]=useState(false);

  const handleSubmit=async()=>{
    if(!email||!pass){setErr("Preencha todos os campos.");return;}
    if(mode==="register"&&!name){setErr("Informe seu nome.");return;}
    setLoading(true);setErr("");
    try{
      if(mode==="register"){
        const{data,error}=await supabase.auth.signUp({email,password:pass,options:{data:{name}}});
        if(error)throw error;
        if(data.user){
          // Tentar criar registro na tabela pacientes
          try{
            const{data:medico}=await supabase.from("medicos").select("id").limit(1).maybeSingle();
            const{error:insErr}=await supabase.from("pacientes").insert({
              user_id:data.user.id,
              medico_id:medico?.id||"c0618c54-a555-4781-8e91-075f8898e54a",
              nome:name,email,
              plano:"Essential",
            });
            if(insErr)console.warn("Paciente será criado após confirmação de e-mail:",insErr.message);
          }catch(e){console.warn("Erro ao criar paciente:",e);}
          onLogin({userId:data.user.id,email,name});
        }
      }else{
        const{data,error}=await supabase.auth.signInWithPassword({email,password:pass});
        if(error)throw error;
        if(data.user){
          onLogin({userId:data.user.id,email,name:data.user.user_metadata?.name||email.split("@")[0]});
        }
      }
    }catch(e){
      setErr(e.message==="Invalid login credentials"?"E-mail ou senha incorretos.":e.message||"Erro ao acessar.");
    }
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",fontFamily:T.fB,color:T.ink}}>
      <div style={{width:"44%",flexShrink:0,background:T.surface,borderRight:`1px solid ${T.border}`,padding:"52px",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"4px 0 24px rgba(60,50,30,0.06)"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:52}}><div style={{width:44,height:44,borderRadius:10,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:700,fontSize:20}}>V</div><span style={{fontFamily:T.fD,fontSize:22,fontWeight:600,color:T.ink}}>Hospital Virtual Verde</span></div>
          <div style={{width:72,height:72,borderRadius:16,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,boxShadow:`0 4px 20px ${T.green}40`}}><span style={{fontSize:28,color:"#FFF",fontWeight:700}}>V</span></div>
          <div style={{fontFamily:T.fD,fontSize:24,color:T.ink,marginBottom:4}}>Hospital Virtual Verde</div>
          <div style={{fontSize:11,color:T.green,letterSpacing:"0.18em",marginBottom:28,fontWeight:600}}>BENEFÍCIO STONE · SAÚDE CONTÍNUA</div>
          <div style={{fontSize:13,color:T.inkMid,lineHeight:2,marginBottom:20,borderLeft:`3px solid ${T.goldBorder}`,paddingLeft:20}}>Especialista em Medicina do Estilo de Vida dedicado a desenvolver saúde e produtividade de executivos de alta performance.</div>
          <div style={{fontSize:13,color:T.inkMid,lineHeight:2}}>Filosofia: não tratar doenças, mas <em>desenvolver saúde e produtividade</em>.</div>
        </div>
        <div><Lbl>Sua equipe de cuidado</Lbl><div style={{display:"flex",gap:16,marginTop:12}}>{EQUIPE.map(e=>(<div key={e.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><div style={{width:48,height:48,borderRadius:"50%",background:e.bg,border:`1.5px solid ${e.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:T.shadowCard}}>{e.icon}</div><span style={{fontSize:9,color:T.inkLight,textAlign:"center"}}>{e.nome}</span></div>))}</div></div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
        <div style={{width:"100%",maxWidth:420}}>
          <div style={{fontFamily:T.fD,fontSize:32,color:T.ink,marginBottom:6}}>{mode==="login"?"Bem-vindo de volta":"Criar sua conta"}</div>
          <div style={{fontSize:13,color:T.inkMid,lineHeight:1.8,marginBottom:36}}>{mode==="login"?"Acesse seu plano de cuidado personalizado.":"Junte-se à equipe HVV."}</div>
          <Card style={{padding:"32px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {mode==="register"&&<TxtInput label="Nome completo" placeholder="Ricardo Costa" value={name} onChange={setName}/>}
              <TxtInput label="E-mail" placeholder="seu@email.com" type="email" value={email} onChange={setEmail}/>
              <TxtInput label="Senha" placeholder="••••••••" type="password" value={pass} onChange={setPass} error={err}/>
              <Btn onClick={handleSubmit} variant="gold" disabled={loading} style={{width:"100%",padding:"13px"}}>{loading?"PROCESSANDO...":(mode==="login"?"ENTRAR →":"CRIAR CONTA →")}</Btn>
            </div>
            <div style={{marginTop:20,textAlign:"center"}}><button onClick={()=>{setMode(mode==="login"?"register":"login");setErr("");}} style={{background:"none",border:"none",fontSize:12,color:T.inkLight,cursor:"pointer",fontFamily:T.fB,textDecoration:"underline"}}>{mode==="login"?"Não tem conta? Criar agora":"Já tem conta? Fazer login"}</button></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── API KEY ──────────────────────────────────────────────────────
export function ScreenApiKey({user,onConfirm,onReset}){
  const[key,setKey]=useState("");const[err,setErr]=useState("");
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fB,padding:24}}>
      <div style={{width:"100%",maxWidth:520}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:40}}><div style={{width:36,height:36,borderRadius:8,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:700,fontSize:16}}>V</div><span style={{fontFamily:T.fD,fontSize:20,fontWeight:600,color:T.ink}}>Hospital Virtual Verde</span></div>
        <Card style={{padding:"0",overflow:"hidden"}}>
          <div style={{background:`linear-gradient(135deg,${T.goldFaint},${T.surface})`,padding:"28px 32px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontFamily:T.fD,fontSize:24,color:T.ink,marginBottom:8}}>Olá, {user.name.split(" ")[0]}! Um último passo.</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.9}}>Para ativar sua equipe de saúde, insira sua <strong style={{color:T.ink}}>chave de acesso à IA</strong>.</div>
          </div>
          <div style={{padding:"20px 32px",borderBottom:`1px solid ${T.border}`,background:T.bgWarm}}>
            {[{icon:"🤖",text:"Conecta o app à IA da sua equipe HVV"},{icon:"🔒",text:"Fica salva apenas no seu dispositivo"},{icon:"💳",text:"Custo baixo — menos de R$ 2 por mês"},{icon:"🎁",text:"Se seu médico forneceu uma chave, use ela aqui"}].map((item,i)=>(<div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}><span style={{fontSize:16,flexShrink:0}}>{item.icon}</span><span style={{fontSize:12,color:T.inkMid,lineHeight:1.6}}>{item.text}</span></div>))}
          </div>
          <div style={{padding:"24px 32px"}}>
            <TxtInput label="Chave de Acesso (API Key)" placeholder="sk-ant-api03-..." value={key} onChange={v=>{setKey(v);setErr("");}} error={err} autoFocus/>
            <div style={{marginTop:16}}><Btn onClick={()=>key.startsWith("sk-")?onConfirm(key):setErr("Chave inválida. Deve começar com sk-ant-")} variant="gold" style={{width:"100%",padding:"13px"}}>ATIVAR MINHA EQUIPE →</Btn></div>
            {onReset&&<div style={{textAlign:"center",marginTop:10}}><button onClick={onReset} style={{background:"none",border:"none",fontSize:10,color:T.inkFaint,cursor:"pointer",fontFamily:T.fB,letterSpacing:"0.1em",textDecoration:"underline"}}>↺ refazer onboarding</button></div>}
            <div style={{marginTop:20,padding:"14px 16px",background:T.surfaceMid,borderRadius:8,border:`1px solid ${T.border}`}}>
              <Lbl>Não tem uma chave?</Lbl>
              <div style={{fontSize:12,color:T.inkMid,lineHeight:1.9}}>1. Acesse <span style={{color:T.gold,fontWeight:600}}>console.anthropic.com</span><br/>2. Crie uma conta gratuita<br/>3. API Keys → + Create Key<br/>4. Copie e cole aqui</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── BOAS-VINDAS ──────────────────────────────────────────────────
export function ScreenBoasVindas({onStart}){
  const[slide,setSlide]=useState(0);
  const slides=[
    {icon:"🩺",titulo:"Seu médico pessoal te conhece de verdade",texto:"No HVV você escolhe um médico que acompanha sua saúde ao longo do tempo — não uma consulta avulsa sem histórico.",cor:T.green},
    {icon:"🤝",titulo:"Sua equipe de saúde com IA",texto:"Ana coordena seu plano. Dra. Lucia cuida da nutrição. Bruno orienta sua atividade física. Rafael verifica seus medicamentos.",cor:T.teal},
    {icon:"✅",titulo:"Check-in de 2 minutos por dia",texto:"Todo dia você registra como está — energia, sono, estresse, humor e vínculos. Sua equipe usa isso para personalizar o cuidado.",cor:T.purple},
    {icon:"📋",titulo:"Plano de cuidado no seu ritmo",texto:"A Ana gera um plano com tarefas concretas para cada área da sua saúde — e acompanha se você está realizando.",cor:T.gold},
    {icon:"⏱",titulo:"3 minutos para começar",texto:"Vamos montar seu perfil de saúde agora — as informações que sua equipe precisa para te conhecer desde o primeiro dia.",cor:T.green},
  ];
  const s=slides[slide];
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fB,padding:40}}>
      <div style={{width:"100%",maxWidth:560}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:48,justifyContent:"center"}}><div style={{width:36,height:36,borderRadius:8,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:700,fontSize:16}}>V</div><span style={{fontFamily:T.fD,fontSize:20,fontWeight:600,color:T.ink}}>Hospital Virtual Verde</span></div>
        <Card style={{padding:"0",overflow:"hidden",marginBottom:24}}>
          <div style={{height:4,background:`linear-gradient(90deg,${s.cor},${s.cor}60)`}}/>
          <div style={{padding:"40px",textAlign:"center"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:`${s.cor}15`,border:`2px solid ${s.cor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 24px"}}>{s.icon}</div>
            <div style={{fontFamily:T.fD,fontSize:26,color:T.ink,marginBottom:14,lineHeight:1.3}}>{s.titulo}</div>
            <div style={{fontSize:14,color:T.inkMid,lineHeight:1.9,maxWidth:420,margin:"0 auto"}}>{s.texto}</div>
          </div>
          <div style={{padding:"0 40px 28px",display:"flex",justifyContent:"center",gap:8}}>{slides.map((_,i)=>(<div key={i} onClick={()=>setSlide(i)} style={{width:i===slide?24:8,height:8,borderRadius:4,background:i===slide?s.cor:T.border,transition:"all 0.3s",cursor:"pointer"}}/>))}</div>
        </Card>
        <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
          <Btn onClick={()=>slide>0&&setSlide(s=>s-1)} variant="outline" disabled={slide===0}>← ANTERIOR</Btn>
          {slide<slides.length-1?<Btn onClick={()=>setSlide(s=>s+1)} variant="gold">PRÓXIMO →</Btn>:<Btn onClick={onStart} variant="gold" style={{flex:1}}>MONTAR MEU PERFIL →</Btn>}
        </div>
        {slide<slides.length-1&&<div style={{textAlign:"center",marginTop:16}}><button onClick={onStart} style={{background:"none",border:"none",fontSize:11,color:T.inkFaint,cursor:"pointer",fontFamily:T.fB,letterSpacing:"0.12em"}}>PULAR INTRODUÇÃO →</button></div>}
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────
const OB_STEPS=["Identidade","Condições de Saúde","Histórico Clínico","Estilo de Vida","Rede de Apoio","Objetivos","Gadgets"];

export function ScreenOnboarding({user,onComplete}){
  const[step,setStep]=useState(0);
  const[f,setF]=useState({nome:user.name,cargo:"",setor:"",idade:"",peso:"",altura:"",horas_trab:50,horas_descanso:2,condicoes:[],condicao_outro:"",meds:[],med_outro:"",alergia_med:"",energia:6,qualidade_vida:6,sintomas:[],sintoma_outro:"",hist_cardio_fam:null,hist_cancer_fam:null,hist_diabetes_fam:null,hist_depressao_fam:null,cirurgias:"",hospitalizacoes:"",colesterol_total:"",colesterol_ldl:"",colesterol_hdl:"",triglicerides:"",glicose_jejum:"",hemoglobina_glicada:"",pressao_sistolica:"",pressao_diastolica:"",sono:7,qual_sono:6,exercicios:[],exercicio_outro:"",freq_treino:3,alcool:"",estresse:6,meditacao:-1,dieta:"",tabaco:"",metas:[],disponibilidade:30,acompanhamento:"",horizonte:"",gadgets:[],gadget_outro:"",quer_kit:null});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const tog=(k,v)=>set(k,(f[k]||[]).includes(v)?(f[k]||[]).filter(x=>x!==v):[...(f[k]||[]),v]);

  const CONDICOES=["Hipertensão","Diabetes T2","Dislipidemia","Apneia do sono","Ansiedade","Depressão","Enxaqueca","Síndrome metabólica","Hipotireoidismo","Refluxo","Nenhuma","Outros"];
  const MEDS=["Antihipertensivo","Estatina","Ansiolítico","Antidepressivo","Metformina","Omeprazol","Levotiroxina","Vitaminas","Anticoagulante","Outros","Nenhum"];
  const SINTOMAS=["Cansaço frequente","Dificuldade de concentração","Dores de cabeça","Insônia","Irritabilidade","Falta de disposição","Dores musculares","Ganho de peso","Queda de cabelo","Nenhum","Outros"];
  const ATIVIDADES=["Musculação","Corrida","Caminhada","Ciclismo","Natação","Pilates","Yoga","Tênis","Funcional","Crossfit","Outros"];
  const GADGETS_OB=["Samsung (Galaxy Watch/Ring)","Apple Watch","Oura Ring","Whoop","Garmin","Dexcom / Libre (CGM)","Withings Scale","Outros"];
  const METAS_LIST=[{id:"energia",icon:"⚡",label:"Mais energia"},{id:"foco",icon:"🎯",label:"Foco e cognição"},{id:"peso",icon:"⚖️",label:"Composição corporal"},{id:"longevidade",icon:"∞",label:"Longevidade"},{id:"estresse",icon:"🌿",label:"Gestão do estresse"},{id:"sono",icon:"◑",label:"Qualidade do sono"},{id:"performance",icon:"▲",label:"Performance atlética"},{id:"libido",icon:"♦",label:"Saúde hormonal"}];

  const panels=[
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><TxtInput label="Nome completo" placeholder="Ricardo Costa" value={f.nome} onChange={v=>set("nome",v)}/><TxtInput label="Idade" placeholder="47" type="number" value={f.idade} onChange={v=>set("idade",v)} unit="anos"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><TxtInput label="Cargo" placeholder="CEO" value={f.cargo} onChange={v=>set("cargo",v)}/><TxtInput label="Setor" placeholder="Financeiro" value={f.setor} onChange={v=>set("setor",v)}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><TxtInput label="Peso" placeholder="82" type="number" value={f.peso} onChange={v=>set("peso",v)} unit="kg"/><TxtInput label="Altura" placeholder="178" type="number" value={f.altura} onChange={v=>set("altura",v)} unit="cm"/></div>
      <SldInput label="Horas de trabalho por semana" value={f.horas_trab} onChange={v=>set("horas_trab",v)} min={20} max={90} unit="h/sem"/>
      <SldInput label="Horas de lazer por dia" value={f.horas_descanso} onChange={v=>set("horas_descanso",v)} min={0} max={8} unit="h/dia" color={T.teal}/>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><Lbl>Condições diagnosticadas</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{CONDICOES.map(c=><Chip key={c} label={c} color={T.teal} bg={T.tealBg} active={(f.condicoes||[]).includes(c)} onClick={()=>tog("condicoes",c)}/>)}</div>{(f.condicoes||[]).includes("Outros")&&<div style={{marginTop:12}}><TxtInput placeholder="Descreva..." value={f.condicao_outro} onChange={v=>set("condicao_outro",v)}/></div>}</div>
      <div><Lbl>Sintomas frequentes</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{SINTOMAS.map(s=><Chip key={s} label={s} color={T.orange} bg={T.orangeBg} active={(f.sintomas||[]).includes(s)} onClick={()=>tog("sintomas",s)}/>)}</div></div>
      <div><Lbl>Medicamentos em uso</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{MEDS.map(m=><Chip key={m} label={m} color={T.teal} bg={T.tealBg} active={(f.meds||[]).includes(m)} onClick={()=>tog("meds",m)}/>)}</div></div>
      <TxtInput label="Alergia a medicamentos?" placeholder="Descreva ou deixe em branco" value={f.alergia_med} onChange={v=>set("alergia_med",v)}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><SldInput label="Nível de energia" value={f.energia} onChange={v=>set("energia",v)} min={1} max={10} unit="/10" color={T.teal}/><SldInput label="Qualidade de vida" value={f.qualidade_vida} onChange={v=>set("qualidade_vida",v)} min={1} max={10} unit="/10" color={T.teal}/></div>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><Lbl>Histórico familiar</Lbl><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{label:"Doenças cardiovasculares",key:"hist_cardio_fam",cor:T.red},{label:"Câncer",key:"hist_cancer_fam",cor:T.purple},{label:"Diabetes",key:"hist_diabetes_fam",cor:T.orange},{label:"Depressão / ansiedade",key:"hist_depressao_fam",cor:T.blue}].map(item=>(<div key={item.key} style={{padding:"14px 16px",background:T.bgWarm,border:`1px solid ${T.border}`,borderRadius:8}}><div style={{fontSize:12,color:T.inkMid,marginBottom:10}}>{item.label}</div><div style={{display:"flex",gap:8}}>{["Sim","Não","Não sei"].map(opt=><Chip key={opt} label={opt} active={f[item.key]===opt} color={item.cor} onClick={()=>set(item.key,opt)}/>)}</div></div>))}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><TxtInput label="Cirurgias anteriores" placeholder="Descreva ou 'Nenhuma'" value={f.cirurgias} onChange={v=>set("cirurgias",v)}/><TxtInput label="Internações anteriores" placeholder="Descreva ou 'Nenhuma'" value={f.hospitalizacoes} onChange={v=>set("hospitalizacoes",v)}/></div>
      <div><Lbl>Exames recentes</Lbl><Card style={{padding:"16px",background:T.bgWarm}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><TxtInput label="Colesterol Total" placeholder="185" type="number" value={f.colesterol_total} onChange={v=>set("colesterol_total",v)} unit="mg/dL"/><TxtInput label="LDL" placeholder="110" type="number" value={f.colesterol_ldl} onChange={v=>set("colesterol_ldl",v)} unit="mg/dL"/><TxtInput label="HDL" placeholder="55" type="number" value={f.colesterol_hdl} onChange={v=>set("colesterol_hdl",v)} unit="mg/dL"/><TxtInput label="Triglicerídeos" placeholder="120" type="number" value={f.triglicerides} onChange={v=>set("triglicerides",v)} unit="mg/dL"/><TxtInput label="Glicose jejum" placeholder="92" type="number" value={f.glicose_jejum} onChange={v=>set("glicose_jejum",v)} unit="mg/dL"/><TxtInput label="HbA1c" placeholder="5.4" type="number" value={f.hemoglobina_glicada} onChange={v=>set("hemoglobina_glicada",v)} unit="%"/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}><TxtInput label="Pressão Sistólica" placeholder="120" type="number" value={f.pressao_sistolica} onChange={v=>set("pressao_sistolica",v)} unit="mmHg"/><TxtInput label="Pressão Diastólica" placeholder="80" type="number" value={f.pressao_diastolica} onChange={v=>set("pressao_diastolica",v)} unit="mmHg"/></div></Card></div>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><SldInput label="Sono por noite" value={f.sono} onChange={v=>set("sono",v)} min={4} max={10} unit="h" color={T.purple}/><SldInput label="Qualidade do sono" value={f.qual_sono} onChange={v=>set("qual_sono",v)} min={1} max={10} unit="/10" color={T.purple}/></div>
      <div><Lbl>Atividades físicas</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{ATIVIDADES.map(e=><Chip key={e} label={e} color={T.teal} bg={T.tealBg} active={(f.exercicios||[]).includes(e)} onClick={()=>tog("exercicios",e)}/>)}</div></div>
      <SldInput label="Frequência de treino" value={f.freq_treino} onChange={v=>set("freq_treino",v)} min={0} max={7} unit="x/sem" color={T.teal}/>
      <SldInput label="Nível de estresse" value={f.estresse} onChange={v=>set("estresse",v)} min={1} max={10} unit="/10" color={T.red}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div><Lbl>Álcool</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Nunca","Ocasional","Semanal","Diário"].map(a=><Chip key={a} label={a} active={f.alcool===a} onClick={()=>set("alcool",a)}/>)}</div></div>
        <div><Lbl>Padrão alimentar</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Onívoro","Mediterrâneo","Low-carb","Vegetariano","Vegano"].map(d=><Chip key={d} label={d} active={f.dieta===d} onClick={()=>set("dieta",d)}/>)}</div></div>
      </div>
      <div><Lbl>Meditação</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Não pratico","Às vezes","Regularmente"].map((o,i)=><Chip key={o} label={o} active={f.meditacao===i} onClick={()=>set("meditacao",i)}/>)}</div></div>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><Lbl>Objetivos principais (até 3)</Lbl><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{METAS_LIST.map(m=>{const active=(f.metas||[]).includes(m.id),limit=(f.metas||[]).length>=3&&!active;return(<button key={m.id} onClick={()=>!limit&&tog("metas",m.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:active?T.goldFaint:T.bgWarm,border:`1.5px solid ${active?T.gold:T.border}`,borderRadius:10,cursor:limit?"not-allowed":"pointer",opacity:limit?0.4:1,transition:"all 0.18s",fontFamily:T.fB,textAlign:"left",boxShadow:T.shadowCard}}><span style={{fontSize:20}}>{m.icon}</span><span style={{fontSize:12,color:active?T.gold:T.inkMid}}>{m.label}</span>{active&&<span style={{marginLeft:"auto",color:T.gold}}>✓</span>}</button>);})}</div></div>
      <SldInput label="Disponibilidade diária para saúde" value={f.disponibilidade} onChange={v=>set("disponibilidade",v)} min={10} max={120} unit=" min/dia"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div><Lbl>Acompanhamento preferido</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Check-ins diários","Relatórios semanais","Alertas sob demanda","Coaching ativo"].map(c=><Chip key={c} label={c} color={T.teal} bg={T.tealBg} active={f.acompanhamento===c} onClick={()=>set("acompanhamento",c)}/>)}</div></div>
        <div><Lbl>Horizonte de resultado</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["1 mês","3 meses","6 meses","1 ano","Longo prazo"].map(h=><Chip key={h} label={h} active={f.horizonte===h} onClick={()=>set("horizonte",h)}/>)}</div></div>
      </div>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div><Lbl>Gadgets e dispositivos</Lbl><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{GADGETS_OB.map(g=>{const active=(f.gadgets||[]).includes(g);return(<button key={g} onClick={()=>tog("gadgets",g)} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:active?T.tealBg:T.bgWarm,border:`1.5px solid ${active?T.teal:T.border}`,borderRadius:10,cursor:"pointer",transition:"all 0.18s",fontFamily:T.fB,boxShadow:T.shadowCard}}><span style={{fontSize:12,color:active?T.teal:T.ink,fontWeight:500}}>{g}</span>{active&&<span style={{marginLeft:"auto",color:T.teal}}>✓</span>}</button>);})}</div></div>
      <Card style={{padding:"20px",background:T.goldFaint,border:`1px solid ${T.goldBorder}`}}>
        <Lbl color={T.gold}>Como seu plano é atualizado automaticamente</Lbl>
        {[{icon:"⌚",t:"Gadgets",d:"Apple Watch, Oura, Garmin enviam dados em tempo real."},{icon:"📄",t:"Documentos",d:"Novos exames ou laudos são incorporados imediatamente."},{icon:"✅",t:"Check-in diário",d:"Ana faz um check-in rápido todo dia."}].map((item,i)=>(<div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}><span style={{fontSize:20,flexShrink:0}}>{item.icon}</span><div><div style={{fontSize:12,color:T.ink,fontWeight:600}}>{item.t}</div><div style={{fontSize:11,color:T.inkMid,lineHeight:1.7}}>{item.d}</div></div></div>))}
      </Card>
    </div>,
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{padding:"16px 18px",background:T.goldFaint,borderRadius:10,border:`1px solid ${T.goldBorder}`}}><div style={{fontSize:13,color:T.gold,fontWeight:600,marginBottom:4}}>Por que perguntamos sobre relacionamentos?</div><div style={{fontSize:12,color:T.inkMid,lineHeight:1.7}}>Vínculos e rede de apoio são determinantes de saúde tão importantes quanto sono e exercício. A Ana usa essas informações para personalizar o acompanhamento.</div></div>
      <div><Lbl>Estado civil</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Casado(a)","Solteiro(a)","União estável","Divorciado(a)","Prefiro não informar"].map(o=><Chip key={o} label={o} active={f.estado_civil===o} onClick={()=>set("estado_civil",o)}/>)}</div></div>
      <div><Lbl>Tem filhos?</Lbl><div style={{display:"flex",gap:8}}>{["Não","Sim — 1 a 2","Sim — 3 ou mais","Prefiro não informar"].map(o=><Chip key={o} label={o} active={f.filhos===o} onClick={()=>set("filhos",o)}/>)}</div></div>
      <SldInput label="Qualidade da rede de apoio (família e amigos próximos)" value={f.qualidade_rede||5} onChange={v=>set("qualidade_rede",v)} min={1} max={10} unit="/10" color={T.purple}/>
      <SldInput label="Satisfação com a vida social" value={f.satisfacao_social||5} onChange={v=>set("satisfacao_social",v)} min={1} max={10} unit="/10" color={T.teal}/>
      <div><Lbl>Com que frequência você tem conexões sociais significativas?</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Raramente","Algumas vezes por semana","Todo dia","Prefiro não informar"].map(o=><Chip key={o} label={o} active={f.freq_social===o} onClick={()=>set("freq_social",o)}/>)}</div></div>
    </div>,
  ];

  const pct=Math.round((step/(OB_STEPS.length-1))*100);
  return(
    <div style={{minHeight:"100vh",display:"flex",background:T.bg,fontFamily:T.fB,color:T.ink}}>
      <div style={{width:220,flexShrink:0,borderRight:`1px solid ${T.border}`,padding:"32px 24px",display:"flex",flexDirection:"column",background:T.surface}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:44}}><div style={{width:28,height:28,borderRadius:6,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:700,fontSize:13}}>V</div><span style={{fontFamily:T.fD,fontSize:15,fontWeight:600,color:T.ink}}>Hospital Virtual Verde</span></div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
          {OB_STEPS.map((s,i)=>{const done=i<step,active=i===step;return(<div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"9px 0",cursor:done?"pointer":"default"}} onClick={()=>done&&setStep(i)}><div style={{display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${done?T.green:active?T.gold:T.border}`,background:done?T.green:active?T.goldFaint:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:done?"#FFF":active?T.gold:T.inkFaint,fontWeight:700,transition:"all 0.3s"}}>{done?"✓":i+1}</div>{i<OB_STEPS.length-1&&<div style={{width:1.5,height:28,background:done?T.green:T.border,marginTop:3}}/>}</div><span style={{fontSize:11,color:active?T.gold:done?T.ink:T.inkFaint,paddingTop:3,fontWeight:active?600:400}}>{s}</span></div>);})}
        </div>
        <div style={{paddingTop:20,borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:10,color:T.inkFaint}}>PROGRESSO</span><span style={{fontSize:12,color:T.inkMid,fontWeight:600}}>{pct}%</span></div><div style={{height:3,background:T.surfaceMid,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.gold},${T.teal})`,transition:"width 0.5s ease"}}/></div></div>
      </div>
      <div style={{flex:1,padding:"48px 52px",overflowY:"auto"}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <div style={{marginBottom:28}}><div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}><span style={{fontSize:12,letterSpacing:"0.2em",color:T.gold,fontWeight:700}}>{`0${step+1}`}</span><span style={{fontSize:11,color:T.inkLight,letterSpacing:"0.15em"}}>— {OB_STEPS[step].toUpperCase()}</span></div><div style={{height:1,background:T.border}}/></div>
          <div key={step} style={{animation:"fadeUp 0.3s ease"}}>{panels[step]}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:40,paddingTop:24,borderTop:`1px solid ${T.border}`}}>
            <Btn onClick={()=>step>0&&setStep(s=>s-1)} variant="outline" disabled={step===0}>← VOLTAR</Btn>
            <Btn onClick={()=>step<OB_STEPS.length-1?setStep(s=>s+1):onComplete(f)} variant={step===OB_STEPS.length-1?"gold":"outline"}>{step===OB_STEPS.length-1?"ENTRAR NA EQUIPE →":"PRÓXIMO →"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────
export function AppPrincipal({user,form,apiKey,pacienteId,onLogout}){
  const[modulo,setModulo]=useState("dashboard");
  const[checkinHoje,setCheckinHoje]=useState(null);
  const[planLog,setPlanLog]=useState([]);
  const[planoRefresh,setPlanoRefresh]=useState(0);
  const[mensagensNaoLidas,setMensagensNaoLidas]=useState(0);
  const[laudoGenetico,setLaudoGenetico]=useState({pdfB64:null,pdfNome:null,analise:null});
  const scores=calcScores(form,checkinHoje);
  const nome=form?.nome||user.name||"Executivo";
  const initials=nome.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();

  useEffect(()=>{
    if(!pacienteId)return;
    const hoje=dataHoje();
    carregarCheckinHoje(pacienteId).then(ci=>{ if(ci) setCheckinHoje(ci); });
    carregarPlanLog(pacienteId).then(log=>setPlanLog(log));
    supabase.from("mensagens").select("id",{count:"exact"}).eq("paciente_id",pacienteId).eq("lida",false).eq("remetente","ana").then(({count})=>setMensagensNaoLidas(count||0));
    // Carregar análise genética salva
    carregarAnaliseGenetica(pacienteId).then(res=>{
      if(res)setLaudoGenetico({pdfB64:null,pdfNome:res.pdfNome,analise:res.analise});
    });
  },[pacienteId]);

  const onPlanUpdate=useCallback(async(evento)=>{
    if(pacienteId)await salvarPlanLog(pacienteId,evento);
    setPlanLog(prev=>[evento,...prev].slice(0,20));
  },[pacienteId]);

  const onCheckinSalvo=useCallback(async(dados)=>{
    if(pacienteId){
      await salvarCheckinDB(pacienteId,dados);
      // Recarregar do banco para garantir dados completos incluindo sintomas e notas
      const ciAtualizado=await carregarCheckinHoje(pacienteId);
      setCheckinHoje(ciAtualizado||dados);
      await onPlanUpdate({icon:"✅",cor:T.teal,titulo:"Check-in diário realizado",descricao:`Energia ${dados.energia}/10 · Sono ${dados.sono}/10 · Estresse ${dados.estresse}/10 · Vínculos ${dados.vinculos||"-"}/10. Scores recalibrados.`,data:new Date().toLocaleDateString("pt-BR")});
    } else {
      setCheckinHoje(dados);
    }
  },[pacienteId,onPlanUpdate]);

  const checkinPendente=!checkinHoje;
  const lowAxis=Object.entries(scores.eixos).sort((a,b)=>a[1]-b[1])[0];

  // Sistemas de prompt para cada membro
  const AVISO_IA="\n\n⚠️ IMPORTANTE: Suas respostas são orientações de IA e devem sempre ser validadas pelo seu médico pessoal antes de qualquer decisão clínica.";
  const buildPrompt=(membro)=>{
    const base=`Perfil: ${nome}, ${form?.cargo||"Executivo"}, ${form?.idade||"—"} anos. Condições: ${(form?.condicoes||[]).filter(c=>c!=="Nenhuma").join(", ")||"nenhuma"}. Medicamentos: ${(form?.meds||[]).filter(m=>m!=="Nenhum").join(", ")||"nenhum"}. Sono: ${form?.sono||7}h qualidade ${form?.qual_sono||5}/10. Treino: ${form?.freq_treino||0}x/sem. Estresse: ${form?.estresse||5}/10. Dieta: ${form?.dieta||"—"}. Score: ${scores.total}/100.`;
    if(membro==="nutri")return `Você é a Dra. Lucia, nutricionista clínica da equipe HVV. Seu escopo é EXCLUSIVAMENTE nutrição, alimentação, dieta e suplementação. Não responda sobre exercícios, medicamentos ou genômica — oriente o paciente a falar com o especialista correto. Tom: preciso, acolhedor e baseado em evidências. ${base}${AVISO_IA}`;
    if(membro==="personal")return `Você é Bruno, especialista em atividade física da equipe HVV. Seu escopo é EXCLUSIVAMENTE exercício físico, treino, condicionamento e recuperação muscular. Não responda sobre nutrição, medicamentos ou genômica — oriente o paciente a falar com o especialista correto. Tom: motivador, técnico e seguro. ${base}${AVISO_IA}`;
    if(membro==="farmaceutico")return `Você é Rafael, farmacêutico clínico da equipe HVV. Seu escopo é EXCLUSIVAMENTE medicamentos, posologia e interações medicamentosas. Não responda sobre nutrição, exercícios ou genômica. Nunca altere prescrições — apenas informe. Mencione que alertará o seu médico pessoal em caso de risco. ${base}${AVISO_IA}`;
    if(membro==="geneticista")return `Você é a Dra. Clara, geneticista clínica da equipe HVV. Seu escopo é EXCLUSIVAMENTE interpretação de laudos genéticos e variantes. Não responda sobre nutrição, exercícios ou medicamentos fora do contexto farmacogenômico. Para riscos elevados, informe que o seu médico pessoal será notificado. ${base}${AVISO_IA}`;
    if(membro==="suporte")return `Você é a Central de Atendimento HVV. Responda dúvidas sobre o app e o programa. Seja claro e amigável. Usuário: ${nome}.`;
    // Ana — acesso total
    const laudoCtx=laudoGenetico?.analise?`\n\nLAUDO GENÉTICO (${laudoGenetico.pdfNome||"disponível"}): ${laudoGenetico.analise.resumo||""}. Risco geral: ${laudoGenetico.analise.nivel_risco_geral||"—"}. Farmacogenômica: ${laudoGenetico.analise.medicamentos||"—"}.`:"\n\nLAUDO GENÉTICO: ainda não enviado.";
    const checkinCtx=checkinHoje?`\n\nCHECK-IN REGISTRADO AGORA — ESTES SÃO OS DADOS REAIS DE HOJE:
Energia: ${checkinHoje.energia}/10 | Sono: ${checkinHoje.sono}/10 | Estresse: ${checkinHoje.estresse}/10 | Humor: ${checkinHoje.humor||"-"}/10
Vínculos: ${checkinHoje.vinculos||"-"}/10 (rede apoio: ${checkinHoje.rede_apoio||"-"}, trabalho: ${checkinHoje.relacoes_trabalho||"-"}, social: ${checkinHoje.vida_social||"-"}, pessoal: ${checkinHoje.relacionamentos_pessoais||"-"})
Bem-estar: ${checkinHoje.bem_estar||"-"}/10${checkinHoje.sintomas?`\nSintomas: ${checkinHoje.sintomas}`:""}${checkinHoje.notas?`\nObservações do paciente: ${checkinHoje.notas}`:""}

INSTRUÇÃO CRÍTICA: Estes dados ACABARAM de ser salvos. Você TEM acesso ao check-in de hoje. NÃO diga que não consegue ver os dados. Abra a conversa comentando diretamente sobre estes números — especialmente os pontos mais críticos. Se estresse >= 7, comente. Se sono <= 4, comente. Se vínculos <= 4, comente. Se o paciente deixou observações, responda a elas diretamente.`:"\nCheck-in de hoje: ainda não realizado.";

    return `Você é Ana, enfermeira coordenadora da equipe de saúde do Hospital Virtual Verde (HVV) — benefício Stone. Você é o ponto central de contato e tem acesso a TODOS os dados do paciente.

Seu papel: coordenar o plano integral de saúde, motivar o paciente, acompanhar os 6 eixos de vitalidade e orientar sobre saúde geral. Para nutrição, exercício ou medicamentos, direcione ao especialista correto da equipe.

PERFIL DO PACIENTE:
- Nome: ${nome}
- Condições: ${(form?.condicoes||[]).filter(c=>c!=="Nenhuma").join(", ")||"nenhuma"}
- Medicamentos: ${(form?.meds||[]).filter(m=>m!=="Nenhum").join(", ")||"nenhum"}
- Sono habitual: ${form?.sono||7}h, qualidade ${form?.qual_sono||5}/10
- Estresse habitual: ${form?.estresse||5}/10
- Treino: ${form?.freq_treino||0}x/semana
- Dieta: ${form?.dieta||"não informada"}
- Rede de apoio: ${form?.qualidade_rede||"-"}/10
- Vida social: ${form?.satisfacao_social||"-"}/10

SCORES DE VITALIDADE:
${Object.entries(scores.eixos).map(([n,sc])=>`- ${n}: ${sc}/100`).join("\n")}
- TOTAL: ${scores.total}/100
${checkinCtx}${laudoCtx}

Tom: acolhedor, preciso e humano. Histórico persistido — você tem memória das sessões anteriores.

⚠️ Suas respostas são orientações de IA — sempre validar com o médico pessoal antes de decisões clínicas.`;
  };

  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,fontFamily:T.fB,color:T.ink,overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:222,flexShrink:0,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",background:T.surface,height:"100vh",position:"sticky",top:0,overflow:"hidden",boxShadow:"2px 0 12px rgba(60,50,30,0.04)"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${T.border}`}}><div style={{display:"flex",alignItems:"baseline",gap:6}}><div style={{width:28,height:28,borderRadius:6,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:700,fontSize:13}}>V</div><span style={{fontFamily:T.fD,fontSize:15,color:T.ink,fontWeight:600}}>Hospital Virtual Verde</span></div><div style={{fontSize:8,letterSpacing:"0.18em",color:T.inkFaint,marginTop:2}}>BENEFÍCIO STONE</div></div>
        <div style={{padding:"12px 16px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:T.goldFaint,border:`1.5px solid ${T.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:T.gold,fontWeight:700,flexShrink:0}}>{initials}</div>
          <div style={{minWidth:0}}><div style={{fontSize:12,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{nome.split(" ")[0]}</div><div style={{fontSize:9,color:T.inkFaint}}>{form?.cargo||"Executivo"}</div></div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
          <div style={{fontSize:8,letterSpacing:"0.2em",color:T.inkFaint,padding:"6px 10px 8px"}}>NAVEGAÇÃO</div>
          {MODULOS.map(m=>{
            const eq=m.membro?EQUIPE.find(e=>e.id===m.membro):null;
            const active=modulo===m.id;
            const showDot=m.id==="ana"&&checkinPendente;
            const showMsg=m.id==="mensagens"&&mensagensNaoLidas>0;
            return(<button key={m.id} onClick={()=>{setModulo(m.id);if(m.id==="mensagens"){setMensagensNaoLidas(0);if(pacienteId)marcarMensagensLidas(pacienteId);}}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:active?T.goldFaint:"transparent",border:`1px solid ${active?T.goldBorder:"transparent"}`,cursor:"pointer",transition:"all 0.18s",fontFamily:T.fB,textAlign:"left",marginBottom:2,boxShadow:active?T.shadowCard:"none"}} onMouseOver={e=>{if(!active)e.currentTarget.style.background=T.surfaceMid;}} onMouseOut={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:15,flexShrink:0}}>{m.icon}</span>
              <span style={{fontSize:12,color:active?T.gold:T.inkMid,fontWeight:active?600:400}}>{m.label}</span>
              {showDot&&<span style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:T.orange,display:"inline-block",animation:"pulse 1.5s ease infinite",flexShrink:0}}/>}
              {showMsg&&<span style={{marginLeft:"auto",fontSize:9,padding:"2px 6px",borderRadius:10,background:T.teal,color:"#FFF",fontWeight:700}}>{mensagensNaoLidas}</span>}
              {!showDot&&!showMsg&&eq&&<div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:eq.cor,boxShadow:`0 0 6px ${eq.cor}60`}}/>}
            </button>);
          })}
          <div style={{fontSize:8,letterSpacing:"0.2em",color:T.inkFaint,padding:"14px 10px 8px"}}>SUA EQUIPE</div>
          {EQUIPE.map(e=>(<div key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",borderRadius:8}}><div style={{width:30,height:30,borderRadius:"50%",background:e.bg,border:`1.5px solid ${e.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{e.icon}</div><div style={{minWidth:0}}><div style={{fontSize:11,color:T.inkMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nome}</div><div style={{fontSize:8,color:T.inkFaint,letterSpacing:"0.08em"}}>{e.titulo}</div></div><div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}60`,flexShrink:0}}/></div>))}
        </div>
        <div style={{padding:"14px 16px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,color:T.inkFaint}}>VITALIDADE</span><span style={{fontSize:13,color:T.gold,fontFamily:T.fD,fontWeight:700}}>{scores.total}/100</span></div>
          <div style={{height:3,background:T.surfaceMid,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${scores.total}%`,background:`linear-gradient(90deg,${T.gold},${T.teal})`}}/></div>
          <button onClick={onLogout} style={{marginTop:12,width:"100%",padding:"7px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.inkFaint,fontFamily:T.fB,fontSize:9,letterSpacing:"0.12em",cursor:"pointer"}}>SAIR</button>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{borderBottom:`1px solid ${T.border}`,padding:"0 28px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,flexShrink:0,boxShadow:T.shadowCard}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.15em"}}>Hospital Virtual Verde</span><span style={{color:T.border}}>›</span><span style={{fontSize:11,color:T.inkMid,letterSpacing:"0.12em",fontWeight:500}}>{MODULOS.find(m=>m.id===modulo)?.label}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:T.green,boxShadow:`0 0 8px ${T.green}60`,animation:"pulse 2s ease infinite"}}/><span style={{fontSize:9,color:T.inkFaint,letterSpacing:"0.12em"}}>EQUIPE ONLINE</span></div>
        </div>

        {modulo==="dashboard"&&<ModuloDashboard form={form} scores={scores} setModulo={setModulo} checkinHoje={checkinHoje} planLog={planLog} onPlanUpdate={onPlanUpdate} pacienteId={pacienteId}/>}
        {modulo==="plano"&&<ModuloPlano key={planoRefresh} form={form} scores={scores} setModulo={setModulo} planLog={planLog} checkinHoje={checkinHoje} pacienteId={pacienteId} apiKey={apiKey}/>}
        {modulo==="ana"&&<ModuloAna form={form} scores={scores} apiKey={apiKey} checkinHoje={checkinHoje} onCheckinSalvo={onCheckinSalvo} onPlanUpdate={onPlanUpdate} pacienteId={pacienteId} getBuildPrompt={buildPrompt} onPlanChange={()=>{setPlanoRefresh(r=>r+1);setModulo("plano");}}/>}
        {modulo==="nutri"&&<ModuloChat membro="nutri" form={form} scores={scores} apiKey={apiKey} pacienteId={pacienteId} systemPrompt={buildPrompt("nutri")} inicialMsg={`Olá, ${nome.split(" ")[0]}! Sou a Dra. Lucia, sua nutricionista. Dieta atual: ${form?.dieta||"não informada"}. Score de Nutrição: ${scores.eixos["Nutrição"]}/100. Como posso ajudar?`} sugestoes={["O que devo comer antes do treino?","Como melhorar minha alimentação?","Quais suplementos são indicados para mim?","Como montar um cardápio executivo?"]}/>}
        {modulo==="personal"&&<ModuloChat membro="personal" form={form} scores={scores} apiKey={apiKey} pacienteId={pacienteId} systemPrompt={buildPrompt("personal")} inicialMsg={`Olá, ${nome.split(" ")[0]}! Sou o Bruno, seu especialista em atividade física. Treino atual: ${form?.freq_treino||0}x/semana. Score de Atividade: ${scores.eixos["Atividade"]}/100. Como posso ajudar?`} sugestoes={["Monte um treino para minha rotina executiva","Como treinar com pouco tempo?","Qual a melhor atividade para reduzir estresse?","Como melhorar minha recuperação?"]}/>}
        {modulo==="farmaceutico"&&<ModuloChat membro="farmaceutico" form={form} scores={scores} apiKey={apiKey} pacienteId={pacienteId} systemPrompt={buildPrompt("farmaceutico")} inicialMsg={`Olá! Sou Rafael. Medicamentos: ${(form?.meds||[]).filter(m=>m!=="Nenhum").join(", ")||"nenhum"}. Em que posso ajudar?`} sugestoes={["Verificar interações","Como tomar minha medicação?","Posso tomar vitaminas junto?"]}/>}
        {modulo==="documentos"&&<ModuloDocumentos apiKey={apiKey} pacienteId={pacienteId} onPlanUpdate={onPlanUpdate}/>}
        {modulo==="mensagens"&&<ModuloMensagens pacienteId={pacienteId} nome={nome}/>}
        {modulo==="integracoes"&&<ModuloIntegracoes/>}
      </div>
    </div>
  );
}

// ─── Módulo Chat genérico ─────────────────────────────────────────
function ModuloChat({membro,form,scores,apiKey,pacienteId,systemPrompt,inicialMsg,sugestoes}){
  const eq=EQUIPE.find(e=>e.id===membro);
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px 28px",display:"flex",alignItems:"center",gap:14,background:T.surface,flexShrink:0,boxShadow:T.shadowCard}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{eq.icon}</div>
        <div><div style={{fontFamily:T.fD,fontSize:20,color:T.ink}}>{eq.nome} · {eq.titulo}</div><div style={{fontSize:9,color:T.green,letterSpacing:"0.15em"}}>● ONLINE · HISTÓRICO SALVO AUTOMATICAMENTE</div></div>
        {membro==="farmaceutico"&&<div style={{marginLeft:"auto",padding:"8px 14px",background:T.redBg,borderRadius:8,border:`1px solid ${T.red}20`}}><div style={{fontSize:11,color:T.red}}>⚠️ Em caso de risco, Rafael alerta o seu médico pessoal.</div></div>}
      </div>
      <ChatIA membro={membro} apiKey={apiKey} placeholder={`Fale com ${eq.nome}...`} inicialMsg={inicialMsg} sugestoes={sugestoes} systemPrompt={systemPrompt} pacienteId={pacienteId}/>
    </div>
  );
}

// ─── Chat da Ana com Tool Use ─────────────────────────────────────
// A Ana pode adicionar, atualizar e remover tarefas do plano de cuidado
function ChatIAComTools({systemPrompt,apiKey,placeholder,sugestoes,inicialMsg,pacienteId,onPlanChange}){
  const eq=EQUIPE.find(e=>e.id==="enfermeira");
  const[msgs,setMsgs]=useState([{role:"assistant",content:inicialMsg}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[carregando,setCarregando]=useState(true);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  const TOOLS=[{
    name:"gerenciar_plano_cuidado",
    description:"Adiciona, atualiza ou remove tarefas do plano de cuidado do paciente. Use quando o paciente pedir para agendar algo, adicionar uma tarefa, remover uma tarefa, ou quando você identificar que uma tarefa precisa ser criada com base na conversa.",
    input_schema:{
      type:"object",
      properties:{
        acao:{type:"string",enum:["adicionar","remover","atualizar"],description:"Ação a realizar no plano"},
        titulo:{type:"string",description:"Título claro e objetivo da tarefa"},
        descricao:{type:"string",description:"Descrição detalhada opcional"},
        area:{type:"string",enum:["saude_geral","nutricao","atividade","emocional","vinculos","prevencao"],description:"Área de saúde da tarefa"},
        frequencia_tipo:{type:"string",enum:["diario","n_vezes_semana","uma_vez_semana","uma_vez_mes","unico"],description:"Frequência da tarefa"},
        meta_semanal:{type:"number",description:"Quantas vezes por semana (apenas para n_vezes_semana)"},
        tarefa_id:{type:"string",description:"ID da tarefa a remover ou atualizar (obrigatório para remover/atualizar)"},
      },
      required:["acao","titulo","area","frequencia_tipo"]
    }
  }];

  useEffect(()=>{
    if(!pacienteId){setCarregando(false);return;}
    const timer=setTimeout(()=>{
      carregarHistoricoChat(pacienteId,"enfermeira").then(hist=>{
        if(hist.length>0)setMsgs([{role:"assistant",content:inicialMsg},...hist]);
        setCarregando(false);
      }).catch(()=>setCarregando(false));
    },3000);
    return()=>clearTimeout(timer);
  },[pacienteId]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const executarTool=async(toolInput)=>{
    const{acao,titulo,descricao,area,frequencia_tipo,meta_semanal,tarefa_id}=toolInput;
    try{
      if(acao==="adicionar"){
        const{data,error}=await supabase.from("plano_cuidado").insert({
          paciente_id:pacienteId,
          titulo,descricao:descricao||"",
          area,frequencia_tipo,
          frequencia:frequencia_tipo,
          meta_semanal:meta_semanal||1,
          origem:"ana",ativo:true,ordem:99
        }).select("id").single();
        if(!error&&onPlanChange)onPlanChange();
        return error?`Erro ao adicionar tarefa: ${error.message}`:`Tarefa "${titulo}" adicionada ao plano com sucesso.`;
      }
      if(acao==="remover"&&tarefa_id){
        const{error}=await supabase.from("plano_cuidado").update({ativo:false}).eq("id",tarefa_id);
        if(!error&&onPlanChange)onPlanChange();
        return error?`Erro ao remover tarefa: ${error.message}`:`Tarefa removida do plano.`;
      }
      if(acao==="atualizar"&&tarefa_id){
        const{error}=await supabase.from("plano_cuidado").update({
          titulo,descricao,area,frequencia_tipo,meta_semanal:meta_semanal||1
        }).eq("id",tarefa_id);
        if(!error&&onPlanChange)onPlanChange();
        return error?`Erro ao atualizar: ${error.message}`:`Tarefa "${titulo}" atualizada.`;
      }
      return "Ação não reconhecida.";
    }catch(e){return `Erro: ${e.message}`;}
  };

  const send=async(text)=>{
    if(!text.trim()||loading||!apiKey)return;
    const userMsg={role:"user",content:text};
    setMsgs(prev=>[...prev,userMsg,{role:"assistant",content:"",loading:true}]);
    setInput("");setLoading(true);
    if(pacienteId)await salvarMensagemChat(pacienteId,"enfermeira","user",text);

    const enviar=async(history,tentativa=1)=>{
      try{
        const res=await fetch("/.netlify/functions/claude",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:1200,
            system:systemPrompt,
            tools:TOOLS,
            messages:history
          })
        });
        if(res.status===429&&tentativa<3){await new Promise(r=>setTimeout(r,3000*tentativa));return enviar(history,tentativa+1);}
        if(res.status===503&&tentativa<3){await new Promise(r=>setTimeout(r,5000*tentativa));return enviar(history,tentativa+1);}

        const data=await res.json();
        const stopReason=data.stop_reason;

        if(stopReason==="tool_use"){
          // Ana quer usar uma ferramenta
          const toolUse=data.content.find(c=>c.type==="tool_use");
          const textContent=data.content.find(c=>c.type==="text");

          // Mostrar o que a Ana disse antes de usar a ferramenta
          if(textContent?.text){
            setMsgs(prev=>[...prev.slice(0,-1),
              {role:"assistant",content:textContent.text},
              {role:"assistant",content:"",loading:true}
            ]);
          }

          // Executar a ferramenta
          const resultado=await executarTool(toolUse.input);

          // Continuar a conversa com o resultado da ferramenta
          const novoHistory=[
            ...history,
            {role:"assistant",content:data.content},
            {role:"user",content:[{type:"tool_result",tool_use_id:toolUse.id,content:resultado}]}
          ];
          return enviar(novoHistory,1);
        }

        // Resposta final
        const resposta=data.content?.find(c=>c.type==="text")?.text||"Erro ao processar.";
        setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:resposta}]);
        if(pacienteId)await salvarMensagemChat(pacienteId,"enfermeira","assistant",resposta);

      }catch(e){
        setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Erro de conexão. Tente novamente."}]);
      }finally{
        setLoading(false);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
        inputRef.current?.focus();
      }
    };

    const history=[...msgs,userMsg].filter(m=>!m.loading).map(m=>({role:m.role,content:m.content}));
    await enviar(history);
  };

  if(carregando)return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:12,color:T.inkFaint}}>Carregando histórico...</div></div>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px 8px"}}>
        {msgs.map((msg,i)=>{
          const isUser=msg.role==="user";
          return(<div key={i} style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:12,marginBottom:20,alignItems:"flex-start"}}>
            {!isUser&&<div style={{width:36,height:36,borderRadius:"50%",background:eq?.bg||T.goldFaint,border:`1.5px solid ${eq?.cor||T.gold}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,marginTop:2}}>{eq?.icon||"🩺"}</div>}
            <div style={{maxWidth:"74%",padding:"14px 18px",background:isUser?T.goldFaint:T.surface,border:`1px solid ${isUser?T.goldBorder:T.border}`,borderRadius:isUser?"16px 16px 4px 16px":"4px 16px 16px 16px",fontSize:13,color:T.ink,lineHeight:1.8,whiteSpace:"pre-wrap",boxShadow:T.shadowCard}}>
              {msg.loading?<span style={{display:"inline-flex",gap:5}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:"50%",background:eq?.cor||T.gold,display:"inline-block",animation:`blink 1.2s ease ${j*0.2}s infinite`}}/>)}</span>:msg.content}
            </div>
          </div>);
        })}
        <div ref={bottomRef}/>
      </div>
      {msgs.length<=1&&sugestoes?.length>0&&(
        <div style={{padding:"0 28px 14px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
          {sugestoes.map((s,i)=>(<button key={i} onClick={()=>send(s)} style={{padding:"8px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,fontSize:12,color:T.inkMid,cursor:"pointer",fontFamily:T.fB,transition:"all 0.18s",boxShadow:T.shadowCard}}>{s}</button>))}
        </div>
      )}
      <div style={{padding:"6px 28px",background:T.surfaceMid,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{fontSize:10,color:T.inkFaint,lineHeight:1.6}}>✦ A Ana pode adicionar tarefas ao seu plano — basta pedir. ⚠️ Valide decisões clínicas com seu médico.</div>
      </div>
      <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 28px",display:"flex",gap:10,alignItems:"flex-end",flexShrink:0,background:T.bgWarm}}>
        <textarea ref={inputRef} rows={1} placeholder={apiKey?placeholder:"Configure a API Key..."} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}} disabled={loading||!apiKey} style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"12px 16px",color:T.ink,fontFamily:T.fB,fontSize:13,outline:"none",lineHeight:1.6,minHeight:44,maxHeight:120,overflow:"hidden",resize:"none",opacity:apiKey?1:0.5,boxShadow:T.shadowCard}}/>
        <button onClick={()=>send(input)} disabled={loading||!input.trim()||!apiKey} style={{width:44,height:44,borderRadius:10,background:(!loading&&input.trim()&&apiKey)?eq?.cor||T.gold:"transparent",border:`1.5px solid ${(!loading&&input.trim()&&apiKey)?eq?.cor||T.gold:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:(!loading&&input.trim()&&apiKey)?"#FFF":T.inkFaint,transition:"all 0.2s",flexShrink:0,fontWeight:700}}>{loading?"…":"↑"}</button>
      </div>
    </div>
  );
}


// ─── Módulo Ana ───────────────────────────────────────────────────
function ModuloAna({form,scores,apiKey,checkinHoje,onCheckinSalvo,onPlanUpdate,pacienteId,getBuildPrompt,onPlanChange}){
  const[aba,setAba]=useState(checkinHoje?"chat":"checkin");
  const eq=EQUIPE.find(e=>e.id==="enfermeira");
  const[ci,setCi]=useState({sono:7,energia:7,estresse:5,humor:7,vinculos:7,bem_estar:7,rede_apoio:7,relacoes_colegas:6,relacoes_lider:6,vida_social:6,relacionamentos_pessoais:7,sintomas:"",notas:""});
  const[salvando,setSalvando]=useState(false);const[salvo,setSalvo]=useState(false);
  const nome=form?.nome||"Executivo";

  const salvarCheckin=async()=>{
    setSalvando(true);
    const dados={...ci,data:new Date().toLocaleDateString("pt-BR"),hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};
    await onCheckinSalvo(dados);setSalvando(false);setSalvo(true);
    setTimeout(()=>{setSalvo(false);setAba("chat");},1500);
  };

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px 28px",display:"flex",alignItems:"center",gap:14,background:T.surface,flexShrink:0,boxShadow:T.shadowCard}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{eq.icon}</div>
        <div><div style={{fontFamily:T.fD,fontSize:20,color:T.ink}}>Ana · Enfermeira Coordenadora</div><div style={{fontSize:9,color:T.green,letterSpacing:"0.15em"}}>● ONLINE · COORDENADORA GERAL · HISTÓRICO COMPLETO SALVO</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:16}}>
          <div style={{textAlign:"right"}}><div style={{fontSize:8,color:T.inkFaint}}>VITALIDADE</div><div style={{fontSize:14,color:T.gold,fontFamily:T.fD,fontWeight:700}}>{scores.total}/100</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:8,color:T.inkFaint}}>CHECK-IN</div><div style={{fontSize:13,color:checkinHoje?T.green:T.orange,fontWeight:700}}>{checkinHoje?"✓ FEITO":"PENDENTE"}</div></div>
        </div>
      </div>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"0 28px",display:"flex",background:T.bgWarm,flexShrink:0}}>
        {[{id:"chat",label:"Conversar com Ana"},{id:"checkin",label:"Check-in Diário"}].map(t=>(<button key={t.id} onClick={()=>setAba(t.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${aba===t.id?T.teal:"transparent"}`,padding:"13px 22px",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:aba===t.id?T.teal:T.inkFaint,cursor:"pointer",fontFamily:T.fB,transition:"all 0.2s",display:"flex",alignItems:"center",gap:6}}>{t.label}{t.id==="checkin"&&!checkinHoje&&<span style={{width:7,height:7,borderRadius:"50%",background:T.orange,display:"inline-block",animation:"pulse 1.5s ease infinite"}}/>}</button>))}
      </div>
      {aba==="chat"&&<ChatIAComTools key={checkinHoje?`checkin-${checkinHoje.energia}-${checkinHoje.sono}`:"sem-checkin"} apiKey={apiKey} placeholder="Fale com Ana sobre qualquer assunto de saúde..." inicialMsg={`Olá, ${nome.split(" ")[0]}! Recebi seu check-in de hoje.\n\n${checkinHoje?`📊 Seus dados de agora:\n• Energia: ${checkinHoje.energia}/10\n• Sono: ${checkinHoje.sono}/10\n• Estresse: ${checkinHoje.estresse}/10${checkinHoje.vinculos?`\n• Vínculos: ${checkinHoje.vinculos}/10`:""}${checkinHoje.bem_estar?`\n• Bem-estar: ${checkinHoje.bem_estar}/10`:""}${checkinHoje.sintomas?`\n• Sintomas relatados: ${checkinHoje.sintomas}`:""}${checkinHoje.notas?`\n• Você escreveu: "${checkinHoje.notas}"`:""}\n\nBaseado nesses dados, o que mais te preocupa agora?`:"Você ainda não fez seu check-in de hoje. Como está se sentindo?"}`} sugestoes={["Comente sobre meus dados de hoje","O que devo priorizar agora?","Como estão meus vínculos?","Algum alerta no meu check-in?"]} systemPrompt={getBuildPrompt("enfermeira")} pacienteId={pacienteId} onPlanChange={onPlanChange}/>}
      {aba==="checkin"&&(
        <div style={{flex:1,overflowY:"auto",padding:"28px"}}>
          <div style={{maxWidth:580,margin:"0 auto"}}>
            {checkinHoje?(
              <Card style={{padding:"28px",textAlign:"center",background:T.greenBg,border:`1px solid ${T.green}30`}}>
                <div style={{fontSize:48,marginBottom:16}}>✅</div>
                <div style={{fontFamily:T.fD,fontSize:22,color:T.ink,marginBottom:8}}>Check-in concluído!</div>
                <div style={{fontSize:13,color:T.inkMid,marginBottom:20,lineHeight:1.7}}>Energia: {checkinHoje.energia}/10 · Sono: {checkinHoje.sono}/10 · Estresse: {checkinHoje.estresse}/10{checkinHoje.vinculos?` · Vínculos: ${checkinHoje.vinculos}/10`:""}</div>
                <Btn onClick={()=>setAba("chat")} variant="teal">CONVERSAR COM ANA →</Btn>
              </Card>
            ):(
              <div>
                <div style={{fontFamily:T.fD,fontSize:24,color:T.ink,marginBottom:6}}>Check-in diário com Ana</div>
                <div style={{fontSize:13,color:T.inkMid,lineHeight:1.8,marginBottom:28}}>2 minutos para atualizar seu plano. Dados salvos automaticamente no seu histórico.</div>
                <Card style={{padding:"28px",display:"flex",flexDirection:"column",gap:22}}>
                  <SldInput label="Como você dormiu esta noite?" value={ci.sono} onChange={v=>setCi(p=>({...p,sono:v}))} min={1} max={10} unit="/10" color={T.purple}/>
                  <SldInput label="Nível de energia agora" value={ci.energia} onChange={v=>setCi(p=>({...p,energia:v}))} min={1} max={10} unit="/10" color={T.teal}/>
                  <SldInput label="Nível de estresse hoje" value={ci.estresse} onChange={v=>setCi(p=>({...p,estresse:v}))} min={1} max={10} unit="/10" color={T.red}/>
                  <SldInput label="Como está seu humor?" value={ci.humor} onChange={v=>setCi(p=>({...p,humor:v}))} min={1} max={10} unit="/10" color={T.gold}/>
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:18,marginTop:4}}>
                    <div style={{fontSize:11,color:T.green,fontWeight:600,letterSpacing:"0.12em",marginBottom:14}}>🤝 VÍNCULOS E RELACIONAMENTOS</div>
                    <div style={{fontSize:12,color:T.inkLight,marginBottom:16,lineHeight:1.7}}>Como foram suas conexões hoje? Relacionamentos são determinantes de saúde tão importantes quanto sono e exercício.</div>
                    <div style={{display:"flex",flexDirection:"column",gap:18}}>
                      <SldInput label="Rede de apoio (família e amigos)" value={ci.rede_apoio} onChange={v=>setCi(p=>({...p,rede_apoio:v,vinculos:Math.round((v+(p.relacoes_trabalho||6)+(p.vida_social||6)+(p.relacionamentos_pessoais||7))/4)}))} min={1} max={10} unit="/10" color={T.purple} hint="Me senti apoiado(a) hoje?"/>
                      <SldInput label="Relacionamento com colegas" value={ci.relacoes_colegas} onChange={v=>setCi(p=>({...p,relacoes_colegas:v,vinculos:Math.round(((p.rede_apoio||7)+v+(p.relacoes_lider||6)+(p.vida_social||6)+(p.relacionamentos_pessoais||7))/5)}))} min={1} max={10} unit="/10" color={T.purple} hint="Ambiente colaborativo e respeitoso com a equipe?"/>
                      <SldInput label="Relacionamento com meu líder" value={ci.relacoes_lider} onChange={v=>setCi(p=>({...p,relacoes_lider:v,vinculos:Math.round(((p.rede_apoio||7)+(p.relacoes_colegas||6)+v+(p.vida_social||6)+(p.relacionamentos_pessoais||7))/5)}))} min={1} max={10} unit="/10" color={T.purple} hint="Me sinto respeitado e apoiado pela liderança?"/>
                      <SldInput label="Vida social" value={ci.vida_social} onChange={v=>setCi(p=>({...p,vida_social:v,vinculos:Math.round(((p.rede_apoio||7)+(p.relacoes_trabalho||6)+v+(p.relacionamentos_pessoais||7))/4)}))} min={1} max={10} unit="/10" color={T.purple} hint="Tive tempo para conexões fora do trabalho?"/>
                      <SldInput label="Relacionamentos pessoais" value={ci.relacionamentos_pessoais} onChange={v=>setCi(p=>({...p,relacionamentos_pessoais:v,vinculos:Math.round(((p.rede_apoio||7)+(p.relacoes_trabalho||6)+(p.vida_social||6)+v)/4)}))} min={1} max={10} unit="/10" color={T.purple} hint="Qualidade das conexões íntimas hoje?"/>
                      <SldInput label="Bem-estar geral" value={ci.bem_estar} onChange={v=>setCi(p=>({...p,bem_estar:v}))} min={1} max={10} unit="/10" color={T.green} hint="Como você se sente de forma geral hoje?"/>
                    </div>
                  </div>
                  <TxtInput label="Algum sintoma hoje?" placeholder="Dor, cansaço, tontura... ou deixe em branco" value={ci.sintomas} onChange={v=>setCi(p=>({...p,sintomas:v}))}/>
                  <TxtInput label="Observações para Ana (opcional)" placeholder="Algo que queira compartilhar..." value={ci.notas} onChange={v=>setCi(p=>({...p,notas:v}))}/>
                  <Btn onClick={salvarCheckin} variant="teal" disabled={salvando} style={{width:"100%",padding:"14px"}}>{salvando?"SALVANDO...":(salvo?"✓ SALVO!":"ENVIAR CHECK-IN →")}</Btn>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Módulo Geneticista ───────────────────────────────────────────

// ─── Chat isolado da Dra. Clara ───────────────────────────────────
function ChatGeneticista({apiKey,analise,pdfNome,systemPrompt}){
  const eq=EQUIPE.find(e=>e.id==="geneticista");
  const inicialMsg=`Olá! Analisei seu laudo "${pdfNome||"genético"}".

${analise?.resumo||"Tenho todos os achados em mãos."}

O que gostaria de saber?`;
  const[msgs,setMsgs]=useState([{role:"assistant",content:inicialMsg}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async(text)=>{
    if(!text.trim()||loading||!apiKey)return;
    const userMsg={role:"user",content:text};
    setMsgs(prev=>[...prev,userMsg,{role:"assistant",content:"",loading:true}]);
    setInput("");setLoading(true);
    const analiseResumida={resumo:analise?.resumo,nivel_risco_geral:analise?.nivel_risco_geral,achados:(analise?.achados||[]).slice(0,6),nutricao:analise?.nutricao,atividade:analise?.atividade,sono:analise?.sono,medicamentos:analise?.medicamentos,rastreamento:analise?.rastreamento};
    const system=`${systemPrompt}

RESULTADOS DO LAUDO "${pdfNome}":
${JSON.stringify(analiseResumida)}

Responda com precisão clínica baseada nestes achados.`;
    const tentarEnviar=async(tentativa=1)=>{
      try{
        const history=msgs.concat(userMsg).filter(m=>!m.loading).map(m=>({role:m.role,content:m.content}));
        const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system,messages:history})});
        if(res.status===429&&tentativa<4){
          await new Promise(r=>setTimeout(r,5000*tentativa));
          return tentarEnviar(tentativa+1);
        }
        const data=await res.json();
        const resposta=data.content?.[0]?.text||"Erro ao processar.";
        setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:resposta}]);
      }catch{
        setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Erro de conexão."}]);
      }finally{
        setLoading(false);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
        inputRef.current?.focus();
      }
    };
    await tentarEnviar();
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px 8px"}}>
        {msgs.map((msg,i)=>{const isUser=msg.role==="user";return(<div key={i} style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:12,marginBottom:20,alignItems:"flex-start"}}>{!isUser&&<div style={{width:36,height:36,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,marginTop:2}}>{eq.icon}</div>}<div style={{maxWidth:"74%",padding:"14px 18px",background:isUser?T.goldFaint:T.surface,border:`1px solid ${isUser?T.goldBorder:T.border}`,borderRadius:isUser?"16px 16px 4px 16px":"4px 16px 16px 16px",fontSize:13,color:T.ink,lineHeight:1.8,whiteSpace:"pre-wrap",boxShadow:T.shadowCard}}>{msg.loading?<span style={{display:"inline-flex",gap:5}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:"50%",background:eq.cor,display:"inline-block",animation:`blink 1.2s ease ${j*0.2}s infinite`}}/>)}</span>:msg.content}</div></div>);})}
        <div ref={bottomRef}/>
      </div>
      {msgs.length<=1&&(
        <div style={{padding:"0 28px 14px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
          {["O que significam minhas variantes de risco?","Como isso afeta minha nutrição?","Quais exames preventivos são prioritários?","Como meus genes afetam meus medicamentos?"].map((s,i)=>(<button key={i} onClick={()=>send(s)} style={{padding:"8px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,fontSize:12,color:T.inkMid,cursor:"pointer",fontFamily:T.fB,transition:"all 0.18s"}} onMouseOver={e=>{e.currentTarget.style.borderColor=eq.cor;e.currentTarget.style.color=eq.cor;}} onMouseOut={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.inkMid;}}>{s}</button>))}
        </div>
      )}
      <div style={{padding:"6px 28px",background:T.surfaceMid,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{fontSize:10,color:T.inkFaint,lineHeight:1.6}}>⚠️ Respostas de IA — valide com o seu médico pessoal antes de decisões clínicas.</div>
      </div>
      <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 28px",display:"flex",gap:10,alignItems:"flex-end",flexShrink:0,background:T.bgWarm}}>
        <textarea ref={inputRef} rows={1} placeholder="Pergunte sobre seus resultados genéticos..." value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}} disabled={loading||!apiKey} style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"12px 16px",color:T.ink,fontFamily:T.fB,fontSize:13,outline:"none",lineHeight:1.6,minHeight:44,maxHeight:120,overflow:"hidden",resize:"none",boxShadow:T.shadowCard}}/>
        <button onClick={()=>send(input)} disabled={loading||!input.trim()||!apiKey} style={{width:44,height:44,borderRadius:10,background:(!loading&&input.trim()&&apiKey)?eq.cor:"transparent",border:`1.5px solid ${(!loading&&input.trim()&&apiKey)?eq.cor:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:(!loading&&input.trim()&&apiKey)?"#FFF":T.inkFaint,transition:"all 0.2s",flexShrink:0,fontWeight:700}}>{loading?"…":"↑"}</button>
      </div>
    </div>
  );
}

function ModuloGeneticista({form,scores,apiKey,pacienteId,systemPrompt,laudoState,setLaudoState}){
  const eq=EQUIPE.find(e=>e.id==="geneticista");
  const pdfB64=laudoState?.pdfB64||null;
  const pdfNome=laudoState?.pdfNome||null;
  const analise=laudoState?.analise||null;
  const setPdfB64=(v)=>setLaudoState(p=>({...p,pdfB64:v}));
  const setPdfNome=(v)=>setLaudoState(p=>({...p,pdfNome:v}));
  const setAnalise=(v)=>setLaudoState(p=>({...p,analise:typeof v==="function"?v(p.analise):v}));
  const[analisando,setAnalisando]=useState(false);
  const[aba,setAba]=useState("risco");const[chatKey,setChatKey]=useState(0);
  const fileRef=useRef(null);
  // Recalcular aba quando laudoState muda
  useEffect(()=>{if(analise&&!analisando)setAba("risco");},[analise]);

  const handlePdf=async(file)=>{
    if(!file)return;
    console.log("=== HANDLE PDF INICIADO ===");
    console.log("file:",file.name,"size:",file.size);
    console.log("pacienteId disponível:",pacienteId);
    console.log("apiKey disponível:",!!apiKey);
    setPdfNome(file.name);setAnalisando(true);setAba("risco");
    const toB64=(f)=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
    const chamarAPI=async(b64,tentativa=1)=>{
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,system:`Analise o laudo genético. Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois. Formato: {"resumo":"2 frases resumindo","nivel_risco_geral":"alto|moderado|baixo","achados":[{"gene":"nome","impacto":"alto|moderado|baixo","orientacao":"orientação em 1 frase"}],"nutricao":"recomendação em 1 frase","atividade":"recomendação em 1 frase","sono":"orientação em 1 frase","medicamentos":"resumo farmacogenômico em 2 frases","rastreamento":"exames prioritários em 1 frase","alertas":[{"nivel":"critico|atencao|informativo","msg":"mensagem curta"}]}. Inclua no máximo 10 achados. RETORNE APENAS O JSON.`,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:"Analise este laudo genético."}]}]})});
      if((res.status===429||res.status===529)&&tentativa<5){
        const espera=res.status===529?10000:3000;
        console.log(`Status ${res.status} — aguardando ${espera/1000}s (tentativa ${tentativa}/5)...`);
        await new Promise(r=>setTimeout(r,espera*tentativa));
        return chamarAPI(b64,tentativa+1);
      }
      return res;
    };
    try{
      const b64=await toB64(file);setPdfB64(b64);
      // PDF não é salvo no Storage — apenas o JSON da análise é salvo na tabela documentos
      console.log("b64 gerado, tamanho:",b64.length);
      console.log("Chamando API Anthropic...");
      const res=await chamarAPI(b64);
      console.log("API respondeu, status:",res.status);
      const data=await res.json();
      console.log("Resposta:",JSON.stringify(data).slice(0,400));
      if(data.error){setAnalise({erro:`Erro: ${data.error.message||"Tente novamente."}`});return;}
      const rawText=data.content?.[0]?.text||"{}";
      console.log("Texto:",rawText.slice(0,400));
      let parsed;
      try{parsed=JSON.parse(rawText.replace(/```json|```/g,"").trim());}
      catch(pe){console.error("JSON parse erro:",pe.message);setAnalise({erro:"Resposta fora do formato esperado."});return;}
      setAnalise(parsed);
      setChatKey(k=>k+1);
      // Salvar análise no Supabase para persistir entre sessões
      console.log("=== DEBUG LAUDO ===");
      console.log("pacienteId:",pacienteId);
      console.log("analise resumo:",parsed?.resumo?.slice(0,50));
      if(pacienteId){
        console.log("Salvando laudo no banco...");
        await salvarAnaliseGenetica(pacienteId,parsed,file.name);
        console.log("Laudo salvo!");
      }else{
        console.error("ERRO: pacienteId é null — laudo não será salvo");
      }
    }catch(e){setAnalise({erro:"Erro ao analisar. Tente novamente."});}finally{setAnalisando(false);}
  };

  const ic=(i)=>({alto:T.red,moderado:T.gold,baixo:T.green})[i]||T.inkMid;
  const ib=(i)=>({alto:T.redBg,moderado:T.goldFaint,baixo:T.greenBg})[i]||T.surfaceMid;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px 28px",display:"flex",alignItems:"center",gap:14,background:T.surface,flexShrink:0}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{eq.icon}</div>
        <div><div style={{fontFamily:T.fD,fontSize:20,color:T.ink}}>{eq.nome} · Geneticista Clínica</div><div style={{fontSize:9,color:T.green,letterSpacing:"0.15em"}}>● ONLINE</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
          {pdfNome&&<span style={{fontSize:10,color:T.purple,background:T.purpleBg,padding:"4px 12px",borderRadius:20}}>📄 {pdfNome.slice(0,24)}</span>}
          <Btn onClick={()=>fileRef.current?.click()} variant="outline" style={{borderColor:T.purple,color:T.purple}}>{pdfB64?"TROCAR LAUDO":"CARREGAR LAUDO →"}</Btn>
          <input ref={fileRef} type="file" accept=".pdf" onChange={e=>handlePdf(e.target.files[0])} style={{display:"none"}}/>
        </div>
      </div>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"0 28px",display:"flex",background:T.bgWarm,flexShrink:0}}>
        {[{id:"risco",label:"Análise de Risco"},{id:"chat",label:"Falar com Dra. Clara"}].map(t=>(<button key={t.id} onClick={()=>setAba(t.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${aba===t.id?T.purple:"transparent"}`,padding:"13px 22px",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:aba===t.id?T.purple:T.inkFaint,cursor:"pointer",fontFamily:T.fB,transition:"all 0.2s"}}>{t.label}</button>))}
      </div>
      {aba==="risco"&&(
        <div style={{flex:1,overflowY:"auto",padding:"28px"}}>
          {!pdfB64&&!analisando&&(<div onClick={()=>fileRef.current?.click()} style={{cursor:"pointer",maxWidth:600,margin:"0 auto"}}><Card style={{padding:"40px",textAlign:"center",border:`2px dashed ${T.purple}40`,background:T.purpleBg}}><div style={{fontSize:48,marginBottom:16}}>🧬</div><div style={{fontFamily:T.fD,fontSize:22,color:T.ink,marginBottom:8}}>Carregue seu laudo genético</div><div style={{fontSize:13,color:T.inkMid,marginBottom:20}}>A Dra. Clara analisa e extrai todos os achados relevantes.</div><Btn variant="outline" style={{borderColor:T.purple,color:T.purple}}>SELECIONAR PDF →</Btn></Card></div>)}
          {analisando&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:20,textAlign:"center"}}><div style={{fontSize:48,animation:"spin 2s linear infinite",display:"inline-block"}}>🧬</div><div style={{fontFamily:T.fD,fontSize:24,color:T.ink}}>Dra. Clara analisando...</div></div>}
          {analise&&!analisando&&(
            <div style={{maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>
              {analise.erro?<Card style={{padding:"20px",background:T.redBg}}><div style={{color:T.red}}>{analise.erro}</div></Card>:(
                <>
                  <Card style={{overflow:"hidden"}}><div style={{padding:"20px 24px",background:T.purpleBg,display:"flex",gap:14}}><div style={{flex:1}}><Lbl color={T.purple}>Dra. Clara · Análise</Lbl><div style={{fontSize:14,color:T.ink,lineHeight:1.8}}>{analise.resumo}</div></div>{analise.nivel_risco_geral&&<div style={{padding:"6px 14px",borderRadius:20,background:ib(analise.nivel_risco_geral),fontSize:10,color:ic(analise.nivel_risco_geral),fontWeight:700,alignSelf:"flex-start"}}>{analise.nivel_risco_geral.toUpperCase()}</div>}</div></Card>
                  {(analise.alertas||[]).map((a,i)=>(<Card key={i} style={{padding:"14px 18px",background:{critico:T.redBg,atencao:T.goldFaint,informativo:T.blueBg}[a.nivel]||T.blueBg}}><div style={{display:"flex",gap:10}}><span>{{critico:"🚨",atencao:"⚠️",informativo:"ℹ️"}[a.nivel]}</span><span style={{fontSize:13,color:T.ink,lineHeight:1.7}}>{a.msg}</span></div></Card>))}
                  {(analise.achados||[]).length>0&&<Card style={{padding:"20px 24px"}}><Lbl>Achados por Variante</Lbl>{analise.achados.map((a,i)=>(<div key={i} style={{padding:"12px 14px",background:ib(a.impacto),borderRadius:8,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div><strong style={{fontSize:12}}>{a.gene}</strong><span style={{fontSize:10,color:T.inkFaint}}> · {a.categoria}</span></div><span style={{fontSize:9,padding:"2px 8px",background:"rgba(255,255,255,0.7)",borderRadius:4,color:ic(a.impacto),fontWeight:700}}>{(a.impacto||"").toUpperCase()}</span></div><div style={{fontSize:11,color:T.inkMid,marginBottom:6}}>{a.variante}</div><div style={{fontSize:12,color:T.ink,lineHeight:1.6,borderTop:`1px solid rgba(0,0,0,0.06)`,paddingTop:6}}><span style={{color:ic(a.impacto)}}>→ </span>{a.orientacao}</div></div>))}</Card>}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {aba==="chat"&&(!pdfB64?<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40,textAlign:"center"}}><div style={{fontSize:48}}>🧬</div><div style={{fontFamily:T.fD,fontSize:22,color:T.inkMid}}>Carregue seu laudo primeiro</div><Btn onClick={()=>fileRef.current?.click()} variant="outline" style={{borderColor:T.purple,color:T.purple}}>SELECIONAR PDF →</Btn></div>:<ChatGeneticista apiKey={apiKey} analise={analise} pdfNome={pdfNome} systemPrompt={systemPrompt}/>
  )}
    </div>
  );
}

// ─── Módulo Documentos ────────────────────────────────────────────
function ModuloDocumentos({apiKey,pacienteId,onPlanUpdate}){
  const fileRef=useRef(null);
  const[docs,setDocs]=useState([]);
  const[selDoc,setSelDoc]=useState(null);
  const[carregando,setCarregando]=useState(true);

  const TIPO_META={"genetico":{icon:"🧬",color:T.purple,bg:T.purpleBg},"imagem":{icon:"🩻",color:T.blue,bg:T.blueBg},"clinico":{icon:"🔬",color:T.teal,bg:T.tealBg},"receita":{icon:"💊",color:T.green,bg:T.greenBg},"atestado":{icon:"📋",color:T.gold,bg:T.goldFaint},"relatorio":{icon:"📄",color:T.orange,bg:T.orangeBg},"consulta":{icon:"🩺",color:T.red,bg:T.redBg},"outro":{icon:"📎",color:T.inkFaint,bg:T.surfaceMid}};

  useEffect(()=>{
    if(!pacienteId)return;
    carregarDocumentos(pacienteId).then(data=>{
      setDocs(data.map(d=>({id:d.id,titulo:d.titulo,tipo:d.tipo,status:"pronto",data:d.data,analise:d.conteudo_json,origem:d.origem})));
      setCarregando(false);
    });
  },[pacienteId]);

  const handleDocUpload=async(files)=>{
    if(!apiKey||!pacienteId)return;
    for(const file of Array.from(files)){
      if(!file.type.includes("pdf"))continue;
      const id=`temp-${Date.now()}`;
      setDocs(prev=>[{id,titulo:file.name.replace(".pdf",""),tipo:"outro",status:"analisando",data:new Date().toLocaleDateString("pt-BR"),analise:null},...prev]);
      setSelDoc(id);
      const toB64=(f)=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
      try{
        const b64=await toB64(file);
        const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:`Analise o documento de saúde e retorne APENAS JSON sem markdown: {"tipo":"genetico|imagem|clinico|receita|atestado|relatorio|consulta|outro","titulo":"título","profissional":"nome","resumo":"resumo 2-3 frases","diagnosticos":["lista"],"medicamentos":[{"nome":"","dose":"","frequencia":""}],"checklist":[{"item":"","urgencia":"alta|media|baixa"}],"alertas":[{"nivel":"critico|atencao|informativo","mensagem":""}],"impacto_plano":"impacto no plano"}`,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:"Analise este documento."}]}]})});
        const data=await res.json();
        const parsed=JSON.parse((data.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim());
        // Salvar no Supabase
        const docSalvo=await salvarDocumento(pacienteId,{titulo:parsed.titulo||file.name,tipo:parsed.tipo||"outro",resumo:parsed.resumo,analise:parsed});
        setDocs(prev=>prev.map(d=>d.id===id?{...d,id:docSalvo?.id||id,titulo:parsed.titulo||d.titulo,tipo:parsed.tipo||"outro",status:"pronto",analise:parsed}:d));
        if(docSalvo)setSelDoc(docSalvo.id);
        await onPlanUpdate({icon:"📄",cor:T.blue,titulo:`Documento analisado: ${parsed.titulo||file.name}`,descricao:parsed.impacto_plano||"Documento incorporado ao plano.",data:new Date().toLocaleDateString("pt-BR")});
      }catch{setDocs(prev=>prev.map(d=>d.id===id?{...d,status:"erro"}:d));}
    }
  };

  const docAtual=docs.find(d=>d.id===selDoc);

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:280,flexShrink:0,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bgWarm}}>
        <div style={{padding:"16px"}}>
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleDocUpload(e.dataTransfer.files);}} onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${T.borderMid}`,borderRadius:10,padding:"20px",textAlign:"center",cursor:"pointer",background:T.surface,transition:"all 0.2s"}} onMouseOver={e=>{e.currentTarget.style.borderColor=T.gold;}} onMouseOut={e=>{e.currentTarget.style.borderColor=T.borderMid;}}>
            <div style={{fontSize:28,marginBottom:6}}>📄</div><div style={{fontSize:12,color:T.inkMid,fontWeight:500}}>Arraste PDFs aqui</div><div style={{fontSize:10,color:T.inkFaint}}>ou clique para selecionar</div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" multiple onChange={e=>handleDocUpload(e.target.files)} style={{display:"none"}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 12px 12px",display:"flex",flexDirection:"column",gap:8}}>
          {carregando&&<div style={{textAlign:"center",padding:"20px",fontSize:11,color:T.inkFaint}}>Carregando...</div>}
          {!carregando&&docs.length===0&&<div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:28,marginBottom:10}}>📂</div><div style={{fontSize:12,color:T.inkFaint}}>Nenhum documento ainda.</div></div>}
          {docs.map(doc=>{const tm=TIPO_META[doc.tipo]||TIPO_META.outro;const isMediaco=doc.origem==="medico";return(<div key={doc.id} onClick={()=>setSelDoc(doc.id)} style={{padding:"12px 14px",background:selDoc===doc.id?T.goldFaint:T.surface,border:`1.5px solid ${selDoc===doc.id?T.gold:T.border}`,borderRadius:8,cursor:"pointer",transition:"all 0.18s"}}><div style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:32,height:32,borderRadius:6,background:tm.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{tm.icon}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:T.ink,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{doc.titulo}</div><div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:tm.bg,color:tm.color,fontWeight:700}}>{doc.tipo.toUpperCase()}</span>{isMediaco&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:T.navyBg||T.blueBg,color:T.blue,fontWeight:700}}>DR.</span>}<span style={{fontSize:9,color:T.inkFaint}}>{doc.data}</span></div></div>{doc.status==="analisando"&&<div style={{width:7,height:7,borderRadius:"50%",background:T.gold,animation:"pulse 1.2s ease infinite",flexShrink:0,marginTop:3}}/>}{doc.status==="pronto"&&<div style={{width:7,height:7,borderRadius:"50%",background:T.green,flexShrink:0,marginTop:3}}/>}</div></div>);})}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
        {!docAtual&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,textAlign:"center"}}><div style={{fontSize:48}}>🩺</div><div style={{fontFamily:T.fD,fontSize:22,color:T.inkMid}}>Selecione ou envie um documento</div><div style={{fontSize:13,color:T.inkFaint,maxWidth:360,lineHeight:1.8}}>A equipe extrai diagnósticos, medicamentos e ações. Documentos do médico aparecem aqui automaticamente.</div></div>}
        {docAtual?.status==="analisando"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"80%",gap:16,textAlign:"center"}}><div style={{fontSize:40,animation:"spin 2s linear infinite",display:"inline-block"}}>🔬</div><div style={{fontFamily:T.fD,fontSize:22,color:T.ink}}>Analisando e atualizando o plano...</div></div>}
        {docAtual?.analise&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:800}}>
            <Card style={{overflow:"hidden"}}><div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:14}}><div style={{width:44,height:44,borderRadius:8,background:(TIPO_META[docAtual.tipo]||TIPO_META.outro).bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{(TIPO_META[docAtual.tipo]||TIPO_META.outro).icon}</div><div><div style={{fontFamily:T.fD,fontSize:20,color:T.ink,marginBottom:4}}>{docAtual.analise.titulo}</div>{docAtual.analise.profissional&&<span style={{fontSize:11,color:T.inkFaint}}>Dr(a). {docAtual.analise.profissional}</span>}</div></div><div style={{padding:"16px 22px",background:T.goldFaint,display:"flex",gap:12}}><div style={{width:30,height:30,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>H</div><div><Lbl color={T.gold}>Equipe HVV · Análise</Lbl><div style={{fontSize:13,color:T.ink,lineHeight:1.75}}>{docAtual.analise.resumo}</div></div></div></Card>
            {docAtual.analise.impacto_plano&&<Card style={{padding:"16px 20px",background:T.tealBg,border:`1px solid ${T.teal}30`}}><div style={{display:"flex",gap:10}}><span style={{fontSize:18}}>📋</span><div><div style={{fontSize:12,color:T.teal,fontWeight:600,marginBottom:4}}>Impacto no Plano de Cuidado</div><div style={{fontSize:12,color:T.inkMid,lineHeight:1.7}}>{docAtual.analise.impacto_plano}</div></div></div></Card>}
            {(docAtual.analise.alertas||[]).map((a,i)=>{const lv={critico:{c:T.red,bg:T.redBg,icon:"🚨"},atencao:{c:T.gold,bg:T.goldFaint,icon:"⚠️"},informativo:{c:T.blue,bg:T.blueBg,icon:"ℹ️"}}[a.nivel]||{c:T.blue,bg:T.blueBg,icon:"ℹ️"};return(<Card key={i} style={{padding:"14px 18px",background:lv.bg}}><div style={{display:"flex",gap:10}}><span style={{fontSize:16}}>{lv.icon}</span><span style={{fontSize:13,color:T.ink,lineHeight:1.6}}>{a.mensagem}</span></div></Card>);})}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {(docAtual.analise.diagnosticos||[]).length>0&&<Card style={{padding:"18px 20px"}}><Lbl color={T.purple}>Diagnósticos</Lbl>{docAtual.analise.diagnosticos.map((d,i)=><div key={i} style={{fontSize:12,color:T.inkMid,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>◆ {d}</div>)}</Card>}
              {(docAtual.analise.medicamentos||[]).length>0&&<Card style={{padding:"18px 20px"}}><Lbl color={T.green}>💊 Medicamentos</Lbl>{docAtual.analise.medicamentos.map((m,i)=>(<div key={i} style={{padding:"8px 10px",background:T.greenBg,borderRadius:5,marginBottom:6,borderLeft:`3px solid ${T.green}`}}><div style={{fontSize:12,color:T.ink,fontWeight:500}}>{m.nome}</div><div style={{fontSize:11,color:T.inkFaint}}>{m.dose} {m.frequencia}</div></div>))}</Card>}
            </div>
            {(docAtual.analise.checklist||[]).length>0&&<Card style={{padding:"18px 20px"}}><Lbl color={T.green}>✓ Ações a Executar</Lbl>{docAtual.analise.checklist.map((item,i)=>(<div key={i} style={{display:"flex",gap:10,padding:"10px 14px",background:T.bgWarm,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6}}><div style={{width:18,height:18,borderRadius:5,border:`2px solid ${T.border}`,flexShrink:0,marginTop:1}}/><span style={{fontSize:12,color:T.inkMid,lineHeight:1.5}}>{item.item}</span></div>))}</Card>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Módulo Mensagens ─────────────────────────────────────────────
function ModuloMensagens({pacienteId,nome}){
  const[msgs,setMsgs]=useState([]);
  const[carregando,setCarregando]=useState(true);
  const[input,setInput]=useState("");
  const[enviando,setEnviando]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{
    if(!pacienteId)return;
    carregarMensagens(pacienteId).then(data=>{setMsgs(data);setCarregando(false);});
    const channel=supabase.channel(`mensagens-${pacienteId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"mensagens",filter:`paciente_id=eq.${pacienteId}`},(payload)=>{setMsgs(prev=>[...prev,payload.new]);})
      .subscribe();
    return()=>supabase.removeChannel(channel);
  },[pacienteId]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const enviar=async()=>{
    if(!input.trim()||enviando||!pacienteId)return;
    setEnviando(true);
    const texto=input.trim();
    setInput("");
    // Buscar medico_id do paciente
    const{data:pac}=await supabase.from("pacientes").select("medico_id").eq("id",pacienteId).single();
    const{data:nova}=await supabase.from("mensagens").insert({
      paciente_id:pacienteId,
      medico_id:pac?.medico_id,
      remetente:"paciente",
      conteudo:texto,
      lida:false,
    }).select().single();
    if(nova)setMsgs(prev=>[...prev,nova]);
    setEnviando(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const eq=EQUIPE.find(e=>e.id==="enfermeira");

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px 28px",display:"flex",alignItems:"center",gap:14,background:T.surface,flexShrink:0,boxShadow:T.shadowCard}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{eq.icon}</div>
        <div><div style={{fontFamily:T.fD,fontSize:20,color:T.ink}}>Mensagens</div><div style={{fontSize:9,color:T.green,letterSpacing:"0.15em"}}>● ONLINE · ANA E DR. DOHMANN</div></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
        {carregando&&<div style={{textAlign:"center",padding:"40px",fontSize:12,color:T.inkFaint}}>Carregando mensagens...</div>}
        {!carregando&&msgs.length===0&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:16,textAlign:"center"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:T.tealBg,border:`2px solid ${T.teal}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>💬</div>
            <div style={{fontFamily:T.fD,fontSize:22,color:T.inkMid}}>Nenhuma mensagem ainda</div>
            <div style={{fontSize:13,color:T.inkFaint,maxWidth:360,lineHeight:1.8}}>Envie uma mensagem para a Ana ou o seu médico pessoal — eles responderão em breve.</div>
          </div>
        )}
        {msgs.map((msg,i)=>{
          const isAna=msg.remetente==="ana";const isMedico=msg.remetente==="medico";
          const isUser=msg.remetente==="paciente";
          return(
            <div key={i} style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:12,marginBottom:18,alignItems:"flex-start"}}>
              {!isUser&&<div style={{width:36,height:36,borderRadius:"50%",background:isAna?T.tealBg:T.blueBg,border:`1.5px solid ${isAna?T.teal:T.blue}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{isAna?"🩺":"👨‍⚕️"}</div>}
              <div style={{maxWidth:"74%"}}>
                <div style={{fontSize:9,color:T.inkFaint,marginBottom:4,fontFamily:T.fB}}>{isAna?"ANA · ENFERMEIRA":isMedico?"DR. DOHMANN":"VOCÊ"} · {new Date(msg.created_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                <div style={{padding:"14px 18px",background:isUser?T.goldFaint:T.surface,border:`1px solid ${isUser?T.goldBorder:T.border}`,borderRadius:isUser?"16px 16px 4px 16px":"4px 16px 16px 16px",fontSize:13,color:T.ink,lineHeight:1.8,whiteSpace:"pre-wrap",boxShadow:T.shadowCard}}>{msg.conteudo}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 28px",display:"flex",gap:10,alignItems:"flex-end",flexShrink:0,background:T.bgWarm}}>
        <textarea ref={inputRef} rows={1} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}} placeholder="Escreva uma mensagem para a Ana ou seu médico pessoal..." disabled={enviando} style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"12px 16px",color:T.ink,fontFamily:T.fB,fontSize:13,outline:"none",lineHeight:1.6,minHeight:44,maxHeight:120,overflow:"hidden",resize:"none",boxShadow:T.shadowCard}}/>
        <button onClick={enviar} disabled={enviando||!input.trim()} style={{width:44,height:44,borderRadius:10,background:(!enviando&&input.trim())?T.teal:"transparent",border:`1.5px solid ${(!enviando&&input.trim())?T.teal:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:(!enviando&&input.trim())?"#FFF":T.inkFaint,transition:"all 0.2s",flexShrink:0,fontWeight:700}}>{enviando?"…":"↑"}</button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────
function ModuloDashboard({form,scores,setModulo,checkinHoje,planLog,onPlanUpdate,pacienteId}){
  const nome=form?.nome||"Colaborador";
  const primeiroNome=nome.split(" ")[0];
  const hora=new Date().getHours();
  const saudacao=hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";
  const lowAxis=Object.entries(scores.eixos).sort((a,b)=>a[1]-b[1])[0];
  const[programas,setProgramas]=useState([]);
  const[inscricoes,setInscricoes]=useState([]);
  const[medicos,setMedicos]=useState([]);
  const[modalPrograma,setModalPrograma]=useState(null);
  const[medicoSelecionado,setMedicoSelecionado]=useState("");
  const[inscrevendo,setInscrevendo]=useState(false);

  useEffect(()=>{
    if(!pacienteId)return;
    supabase.from("pacientes").select("empresa_id").eq("id",pacienteId).single().then(({data})=>{
      if(data?.empresa_id)carregarProgramas(data.empresa_id).then(setProgramas);
    });
    carregarInscricoes(pacienteId).then(setInscricoes);
    carregarMedicos().then(setMedicos);
  },[pacienteId]);

  const isInscrito=(programaId)=>inscricoes.some(i=>i.programa_id===programaId);

  const handleInscrever=async()=>{
    if(!modalPrograma||!medicoSelecionado)return;
    setInscrevendo(true);
    await inscreverPrograma(pacienteId,modalPrograma.id,medicoSelecionado);
    const novas=await carregarInscricoes(pacienteId);
    setInscricoes(novas);
    setInscrevendo(false);
    setModalPrograma(null);
    setMedicoSelecionado("");
  };

  return(
    <div style={{flex:1,overflowY:"auto",padding:"32px"}}>
      <div style={{maxWidth:980,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

        {/* Cabeçalho */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:T.fD,fontSize:32,color:T.ink,marginBottom:4}}>{saudacao}, {primeiroNome}.</div>
            <div style={{fontSize:13,color:T.inkMid}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})} · Sua equipe HVV está ativa.</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:4}}>VITALIDADE</div>
            <RadialScore value={scores.total} size={64}/>
          </div>
        </div>

        {/* Check-in */}
        {!checkinHoje?(
          <Card style={{padding:"20px 24px",background:T.tealBg,border:`1px solid ${T.teal}30`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontFamily:T.fD,fontSize:18,color:T.ink,marginBottom:4}}>Check-in diário pendente</div><div style={{fontSize:12,color:T.inkMid}}>2 minutos para atualizar seu plano. A Ana está esperando.</div></div>
            <Btn onClick={()=>setModulo("ana")} variant="teal">FAZER CHECK-IN →</Btn>
          </Card>
        ):(
          <Card style={{padding:"16px 20px",background:T.greenBg,border:`1px solid ${T.green}30`,display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✓</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:T.ink,fontWeight:500,marginBottom:3}}>Check-in concluído hoje</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[["Energia",checkinHoje.energia,T.teal],["Sono",checkinHoje.sono,T.purple],["Estresse",checkinHoje.estresse,T.red],["Vínculos",checkinHoje.vinculos,T.blue]].filter(([,v])=>v).map(([label,val,cor])=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:4,height:4,borderRadius:"50%",background:cor}}/><span style={{fontSize:11,color:T.inkMid}}>{label}: <strong style={{color:cor}}>{val}/10</strong></span></div>
                ))}
              </div>
            </div>
            <Btn onClick={()=>setModulo("ana")} variant="outline" style={{fontSize:11}}>Ver detalhes →</Btn>
          </Card>
        )}

        {/* Score por eixo */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
          {Object.entries(scores.eixos).map(([n,sc])=>(
            <Card key={n} style={{padding:"14px 12px",textAlign:"center"}}>
              <div style={{fontSize:22,fontFamily:T.fD,fontWeight:700,color:AXIS_COLORS[n]||T.gold,lineHeight:1,marginBottom:4}}>{sc}</div>
              <div style={{fontSize:10,color:T.inkMid,marginBottom:6}}>{n}</div>
              <div style={{height:3,background:T.surfaceMid,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${sc}%`,background:AXIS_COLORS[n]||T.gold}}/></div>
            </Card>
          ))}
        </div>

        {/* Programas ativos */}
        {inscricoes.length>0&&(
          <div>
            <Lbl style={{marginBottom:12}}>Meus programas ativos</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {inscricoes.map(insc=>{
                const prog=insc.programas;
                return(
                  <Card key={insc.id} style={{padding:"18px",borderLeft:`3px solid ${prog?.cor||T.green}`,cursor:"pointer"}} onClick={()=>setModulo("ana")}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${prog?.cor||T.green}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{prog?.icone||"🩺"}</div>
                      <div>
                        <div style={{fontFamily:T.fD,fontSize:14,color:T.ink}}>{prog?.nome}</div>
                        {insc.medicos&&<div style={{fontSize:10,color:T.inkFaint}}>Dr(a). {insc.medicos.nome}</div>}
                      </div>
                      <span style={{marginLeft:"auto",fontSize:9,padding:"2px 8px",borderRadius:8,background:T.greenBg,color:T.green,fontWeight:600}}>ATIVO</span>
                    </div>
                    <div style={{fontSize:11,color:T.inkMid,lineHeight:1.6}}>{prog?.descricao?.slice(0,80)}...</div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Programas disponíveis */}
        {programas.filter(p=>!isInscrito(p.id)).length>0&&(
          <div>
            <Lbl style={{marginBottom:12}}>{inscricoes.length>0?"Outros programas disponíveis":"Programas de saúde disponíveis"}</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {programas.filter(p=>!isInscrito(p.id)).map(p=>(
                <Card key={p.id} style={{padding:"18px",borderLeft:`3px solid ${p.cor||T.green}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`${p.cor||T.green}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{p.icone||"🩺"}</div>
                    <div style={{fontFamily:T.fD,fontSize:14,color:T.ink,flex:1}}>{p.nome}</div>
                  </div>
                  <div style={{fontSize:11,color:T.inkMid,lineHeight:1.6,marginBottom:12}}>{p.descricao?.slice(0,90)}...</div>
                  <Btn onClick={()=>{setModalPrograma(p);setMedicoSelecionado("");}} variant="outline" style={{width:"100%",fontSize:11}}>PARTICIPAR →</Btn>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Ana */}
        <Card style={{padding:"20px 24px",background:T.tealBg,border:`1px solid ${T.teal}30`,display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:T.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🩺</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:T.fD,fontSize:18,color:T.ink,marginBottom:3}}>Ana · Enfermeira Coordenadora</div>
            <div style={{fontSize:12,color:T.inkMid}}>Coordena todos os seus programas, lê seu plano e está disponível a qualquer momento.</div>
          </div>
          <Btn onClick={()=>setModulo("ana")} variant="teal">FALAR COM ANA →</Btn>
        </Card>

        {/* Prioridade da semana */}
        <Card style={{padding:"20px 24px",background:T.goldFaint,border:`1px solid ${T.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <Lbl color={T.gold}>Prioridade da semana</Lbl>
            <div style={{fontFamily:T.fD,fontSize:20,color:T.ink,marginTop:4}}>
              Foco em <span style={{color:AXIS_COLORS[lowAxis[0]]||T.gold}}>{lowAxis[0]}</span>
              <span style={{fontSize:13,color:T.inkMid,fontFamily:T.fB,marginLeft:8}}>score atual: {lowAxis[1]}/100</span>
            </div>
          </div>
          <Btn onClick={()=>setModulo("plano")} variant="gold">VER PLANO DE CUIDADO →</Btn>
        </Card>

      </div>

      {/* Modal inscrição */}
      {modalPrograma&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <Card style={{width:"100%",maxWidth:480,padding:"32px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <div style={{width:48,height:48,borderRadius:12,background:`${modalPrograma.cor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{modalPrograma.icone}</div>
              <div>
                <div style={{fontFamily:T.fD,fontSize:20,color:T.ink}}>{modalPrograma.nome}</div>
                <div style={{fontSize:12,color:T.inkMid}}>Escolha seu médico para começar</div>
              </div>
            </div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.8,marginBottom:20}}>{modalPrograma.descricao}</div>
            <div style={{marginBottom:20}}>
              <Lbl>Escolha seu médico pessoal</Lbl>
              <select value={medicoSelecionado} onChange={e=>setMedicoSelecionado(e.target.value)}
                style={{width:"100%",padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontFamily:T.fB,fontSize:13,background:T.surface,color:T.ink,marginTop:6}}>
                <option value="">Selecionar médico...</option>
                {medicos.map(m=>(<option key={m.id} value={m.id}>{m.nome} — {m.especialidade||"Clínica Geral"}</option>))}
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setModalPrograma(null)} variant="outline" style={{flex:1}}>Cancelar</Btn>
              <Btn onClick={handleInscrever} variant="gold" disabled={!medicoSelecionado||inscrevendo} style={{flex:2}}>
                {inscrevendo?"Inscrevendo...":"PARTICIPAR →"}
              </Btn>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}


function ModuloPlano({form,scores,setModulo,planLog,checkinHoje,pacienteId,apiKey}){
  const[tarefas,setTarefas]=useState([]);
  const[registros,setRegistros]=useState({});
  const[registrosPorData,setRegistrosPorData]=useState({});
  const[loading,setLoading]=useState(true);
  const[gerando,setGerando]=useState(false);
  const eq=EQUIPE.find(e=>e.id==="enfermeira");

  const AREA_CONFIG={
    saude_geral:{label:"Saúde Geral",icon:"🩺",cor:T.green,bg:T.greenBg},
    nutricao:{label:"Nutrição",icon:"🥗",cor:T.gold,bg:T.goldFaint},
    atividade:{label:"Atividade Física",icon:"🏃",cor:T.teal,bg:T.tealBg},
    emocional:{label:"Saúde Emocional",icon:"🧘",cor:T.purple,bg:T.purpleBg},
    vinculos:{label:"Vínculos",icon:"🤝",cor:T.blue,bg:T.blueBg},
    prevencao:{label:"Prevenção",icon:"🔬",cor:T.orange,bg:T.orangeBg},
  };

  useEffect(()=>{
    if(!pacienteId)return;
    (async()=>{
      setLoading(true);
      const[ts,rs]=await Promise.all([
        carregarPlanoCuidado(pacienteId),
        carregarRegistrosHoje(pacienteId),
      ]);
      setTarefas(ts);
      // Mapear registros por tarefa_id
      const mapa={};
      const porData={};
      rs.forEach(r=>{
        if(!mapa[r.tarefa_id]){mapa[r.tarefa_id]={status:r.status,data:r.data};}
        if(!porData[r.tarefa_id])porData[r.tarefa_id]={};
        porData[r.tarefa_id][r.data]=r.status;
      });
      setRegistros(mapa);
      setRegistrosPorData(porData);
      setLoading(false);
    })();
  },[pacienteId]);

  // Retorna início da semana atual (segunda-feira)
  const inicioSemana=()=>{
    const d=new Date();
    const dia=d.getDay();
    const diff=dia===0?-6:1-dia; // ajuste para segunda
    const seg=new Date(d);
    seg.setDate(d.getDate()+diff);
    return `${seg.getFullYear()}-${String(seg.getMonth()+1).padStart(2,'0')}-${String(seg.getDate()).padStart(2,'0')}`;
  };

  // Quantas vezes a tarefa foi concluída nesta semana
  const concluidasNaSemana=(tarefaId)=>{
    const seg=inicioSemana();
    return Object.entries(registrosPorData[tarefaId]||{})
      .filter(([data,status])=>data>=seg && status==="concluido")
      .length;
  };

  const isTarefaConcluida=(tarefa)=>{
    const tipo=tarefa.frequencia_tipo||tarefa.frequencia||"diario";
    const hoje=dataHoje();

    if(tipo==="unico"){
      // Aparece uma vez, some quando marcado
      return !!registros[tarefa.id];
    }
    if(tipo==="diario"){
      // Reseta todo dia
      return registros[tarefa.id]?.data===hoje;
    }
    if(tipo==="n_vezes_semana"){
      // Meta semanal — some quando atingir N vezes
      const meta=tarefa.meta_semanal||3;
      return concluidasNaSemana(tarefa.id)>=meta;
    }
    if(tipo==="uma_vez_semana"){
      // Marcado nesta semana
      const seg=inicioSemana();
      return Object.entries(registrosPorData[tarefa.id]||{})
        .some(([data,status])=>data>=seg && status==="concluido");
    }
    if(tipo==="uma_vez_mes" || tipo==="mensal"){
      // Marcado neste mês
      const mesAtual=dataHoje().slice(0,7); // YYYY-MM
      return Object.entries(registrosPorData[tarefa.id]||{})
        .some(([data,status])=>data.startsWith(mesAtual) && status==="concluido");
    }
    // fallback diário
    return registros[tarefa.id]?.data===hoje;
  };

  // Para n_vezes_semana — mostrar progresso
  const progressoSemanal=(tarefa)=>{
    if((tarefa.frequencia_tipo||tarefa.frequencia)!=="n_vezes_semana")return null;
    const meta=tarefa.meta_semanal||3;
    const feitas=concluidasNaSemana(tarefa.id);
    return {feitas,meta};
  };

  const toggleTarefa=async(tarefa)=>{
    const tipo=tarefa.frequencia_tipo||tarefa.frequencia||"diario";
    const hoje=dataHoje();
    const feita=isTarefaConcluida(tarefa);

    if(tipo==="n_vezes_semana" && !feita){
      // Adicionar mais uma ocorrência hoje
      const novoReg={status:"concluido",data:hoje};
      setRegistros(prev=>({...prev,[tarefa.id]:novoReg}));
      setRegistrosPorData(prev=>({...prev,[tarefa.id]:{...(prev[tarefa.id]||{}),[hoje]:"concluido"}}));
      await registrarTarefa(tarefa.id,pacienteId,"concluido");
    } else if(feita && tipo!=="unico"){
      // Desmarcar ocorrência de hoje
      setRegistros(prev=>{const n={...prev};delete n[tarefa.id];return n;});
      setRegistrosPorData(prev=>({...prev,[tarefa.id]:{...(prev[tarefa.id]||{}),[hoje]:"pendente"}}));
      await registrarTarefa(tarefa.id,pacienteId,"pendente");
    } else if(!feita){
      setRegistros(prev=>({...prev,[tarefa.id]:{status:"concluido",data:hoje}}));
      setRegistrosPorData(prev=>({...prev,[tarefa.id]:{...(prev[tarefa.id]||{}),[hoje]:"concluido"}}));
      await registrarTarefa(tarefa.id,pacienteId,"concluido");
    }
  };

  const handleGerarPlano=async()=>{
    setGerando(true);
    const novas=await gerarPlanoInicial(pacienteId,form,apiKey);
    if(novas.length>0){
      const ts=await carregarPlanoCuidado(pacienteId);
      setTarefas(ts);
    }
    setGerando(false);
  };

  const concluidas=tarefas.filter(t=>isTarefaConcluida(t)).length;
  const areas=[...new Set(tarefas.map(t=>t.area))];

  if(loading)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Spinner/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",padding:"32px"}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <div style={{width:50,height:50,borderRadius:"50%",background:eq.bg,border:`1.5px solid ${eq.cor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{eq.icon}</div>
          <div><div style={{fontFamily:T.fD,fontSize:26,color:T.ink}}>Plano de Cuidado</div><div style={{fontSize:11,color:T.inkFaint}}>Coordenado pela Ana · {tarefas.length} tarefas ativas · {concluidas} concluídas hoje</div></div>
          <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:9,color:T.inkFaint}}>VITALIDADE</div><div style={{fontFamily:T.fD,fontSize:30,color:scores.total>=75?T.green:scores.total>=50?T.gold:T.red,fontWeight:700}}>{scores.total}<span style={{fontSize:14,color:T.inkFaint}}>/100</span></div></div>
        </div>

        {tarefas.length===0?(
          <Card style={{padding:"40px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16}}>📋</div>
            <div style={{fontFamily:T.fD,fontSize:22,color:T.ink,marginBottom:8}}>Seu plano ainda não foi gerado</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.9,maxWidth:420,margin:"0 auto 24px"}}>A Ana vai criar um plano personalizado com base no seu perfil de saúde. Leva menos de 30 segundos.</div>
            <Btn onClick={handleGerarPlano} variant="gold" disabled={gerando} style={{padding:"13px 28px"}}>
              {gerando?"Gerando seu plano...":"✦ Gerar meu plano com IA →"}
            </Btn>
          </Card>
        ):(
          <>
            {/* Progresso geral */}
            <Card style={{padding:"20px 24px",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontFamily:T.fD,fontSize:18,color:T.ink}}>Progresso de hoje</div>
                <div style={{fontSize:13,color:T.inkMid}}>{concluidas}/{tarefas.length} concluídas</div>
              </div>
              <div style={{height:8,background:T.surfaceMid,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${tarefas.length?(concluidas/tarefas.length)*100:0}%`,background:`linear-gradient(90deg,${T.gold},${T.green})`,transition:"width 0.3s",borderRadius:4}}/>
              </div>
            </Card>

            {/* Tarefas por área */}
            {areas.map(area=>{
              const cfg=AREA_CONFIG[area]||{label:area,icon:"📋",cor:T.gold,bg:T.goldFaint};
              const ts=tarefas.filter(t=>t.area===area);
              const done=ts.filter(t=>registros[t.id]==="concluido").length;
              return(
                <Card key={area} style={{padding:"0",overflow:"hidden",marginBottom:12}}>
                  <div style={{padding:"12px 18px",background:cfg.bg,borderBottom:`1px solid ${cfg.cor}20`,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:18}}>{cfg.icon}</span>
                    <span style={{fontFamily:T.fD,fontSize:16,color:T.ink}}>{cfg.label}</span>
                    <span style={{marginLeft:"auto",fontSize:11,color:cfg.cor,fontWeight:600}}>{done}/{ts.length}</span>
                  </div>
                  {ts.map(tarefa=>{
                    const feita=isTarefaConcluida(tarefa);
                    return(
                      <div key={tarefa.id} onClick={()=>toggleTarefa(tarefa)}
                        style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 18px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:feita?T.surfaceMid:"transparent",transition:"background 0.15s"}}
                      >
                        <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${feita?T.green:cfg.cor}`,background:feita?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                          {feita&&<span style={{fontSize:11,color:"#FFF",fontWeight:700}}>✓</span>}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:feita?T.inkFaint:T.ink,fontWeight:500,textDecoration:feita?"line-through":"none",marginBottom:2}}>{tarefa.titulo}</div>
                          {tarefa.descricao&&<div style={{fontSize:11,color:T.inkFaint,lineHeight:1.5}}>{tarefa.descricao}</div>}
                        </div>
                        <span style={{fontSize:9,padding:"2px 8px",borderRadius:4,background:cfg.bg,color:cfg.cor,fontWeight:700,flexShrink:0,marginTop:2}}>
                        {(()=>{const prog=progressoSemanal(tarefa);return prog?`${prog.feitas}/${prog.meta}x SEMANA`:(tarefa.frequencia_tipo||tarefa.frequencia||"diario").toUpperCase().replace("_"," ");})()}
                      </span>
                      </div>
                    );
                  })}
                </Card>
              );
            })}

            {/* Scores por eixo */}
            <Card style={{padding:"20px",marginBottom:16}}>
              <Lbl>Vitalidade por eixo</Lbl>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
                {Object.entries(scores.eixos).map(([n,sc],i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:11,color:T.inkMid,width:120,flexShrink:0}}>{n}</span>
                    <div style={{flex:1,height:5,background:T.surfaceMid,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${sc}%`,background:AXIS_COLORS[n]||T.gold,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:13,color:AXIS_COLORS[n]||T.gold,fontFamily:T.fD,fontWeight:700,width:28,textAlign:"right"}}>{sc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Integrações ──────────────────────────────────────────────────
function ModuloIntegracoes(){
  const INTEGRACOES=[{id:"samsung",nome:"Samsung Health",icon:"📱",color:T.blue,plat:["Android"],passos:["Abra o Samsung Health no Android","Emparelhe Galaxy Watch via Bluetooth","Configurações → Google Fit → Conectar","HVV lê via Google Fit automaticamente"]},{id:"apple",nome:"Apple Health",icon:"❤️",color:T.red,plat:["iOS"],passos:["Abra o app Saúde no iPhone","Vá em seu nome → Apps e Dispositivos","Autorize o HVV na primeira abertura","Sincronização automática em segundo plano"]},{id:"watch",nome:"Apple Watch",icon:"⌚",color:T.blue,plat:["iOS"],passos:["Emparelhe com iPhone pelo app Watch","Ative monitoramento de sono","Ative HRV em Configurações","Dados chegam via Apple Health"]},{id:"garmin",nome:"Garmin",icon:"🏔",color:T.orange,plat:["iOS","Android"],passos:["Instale o Garmin Connect","Ative compartilhamento","Conecte ao Apple Health","HVV recebe Body Battery"]},{id:"oura",nome:"Oura Ring",icon:"💍",color:T.purple,plat:["iOS","Android"],passos:["Baixe o app Oura","Use toda noite","App Oura → Apple Health → Ativar","Android: Personal Token em ouraring.com"]},{id:"whoop",nome:"Whoop 4.0",icon:"📿",color:T.green,plat:["iOS","Android"],passos:["Baixe o app Whoop","Use 24h no pulso","Whoop → Apple Health → Conectar","Recovery Score ajusta seu treino"]},{id:"withings",nome:"Withings Scale",icon:"⚖️",color:T.gold,plat:["iOS","Android"],passos:["Instale Health Mate via Wi-Fi","Pese-se pela manhã","Health Mate → Apple Health","HVV ajusta metas"]},{id:"dexcom",nome:"Dexcom G7",icon:"📡",color:T.orange,plat:["iOS","Android"],passos:["Necessita prescrição médica","Aplique o sensor no braço","Instale o app Dexcom G7","App Dexcom → Apple Health"]}];
  const[selInt,setSelInt]=useState(null);const[connected,setConnected]=useState({});const[stepsDone,setStepsDone]=useState({});
  const item=INTEGRACOES.find(i=>i.id===selInt);
  const isSD=(id,idx)=>!!stepsDone[`${id}-${idx}`];
  const togSD=(id,idx)=>{const k=`${id}-${idx}`;setStepsDone(prev=>({...prev,[k]:!prev[k]}));};
  const allDone=(id)=>{const it=INTEGRACOES.find(i=>i.id===id);return it?.passos.every((_,idx)=>isSD(id,idx));};
  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px",background:T.bg}}>
        <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.15em",marginBottom:16}}>DISPOSITIVOS — {Object.values(connected).filter(Boolean).length} CONECTADO(S)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
          {INTEGRACOES.map(it=>{const conn=!!connected[it.id];return(<Card key={it.id} onClick={()=>setSelInt(it.id===selInt?null:it.id)} style={{padding:"18px",border:`1.5px solid ${selInt===it.id?T.gold:conn?T.green+"60":T.border}`,background:selInt===it.id?T.goldFaint:T.surface}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{width:40,height:40,borderRadius:10,background:conn?T.greenBg:`${it.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{it.icon}</div><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:conn?T.green:T.surfaceMid}}/><span style={{fontSize:9,color:conn?T.green:T.inkFaint}}>{conn?"CONECTADO":"OFFLINE"}</span></div></div><div style={{fontSize:13,color:T.ink,fontWeight:600,marginBottom:6}}>{it.nome}</div><div style={{display:"flex",gap:4}}>{it.plat.map(p=><span key={p} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:p==="iOS"?T.blueBg:T.greenBg,color:p==="iOS"?T.blue:T.green,fontFamily:T.fB}}>{p}</span>)}</div></Card>);})}
        </div>
      </div>
      {item&&(<div style={{width:340,flexShrink:0,borderLeft:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden",background:T.surface}}><div style={{padding:"20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:10,background:`${item.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{item.icon}</div><div style={{flex:1}}><div style={{fontSize:14,color:T.ink,fontWeight:600}}>{item.nome}</div></div><button onClick={()=>setSelInt(null)} style={{background:"none",border:"none",color:T.inkFaint,cursor:"pointer",fontSize:18}}>✕</button></div><div style={{flex:1,overflowY:"auto",padding:"20px"}}><Lbl color={T.gold}>Passos de Configuração</Lbl><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>{item.passos.map((p,i)=>{const done=isSD(item.id,i);return(<div key={i} onClick={()=>togSD(item.id,i)} style={{display:"flex",gap:10,padding:"12px 14px",background:done?T.greenBg:T.bgWarm,border:`1.5px solid ${done?T.green+"50":T.border}`,borderRadius:8,cursor:"pointer",transition:"all 0.2s"}}><div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${done?T.green:T.borderMid}`,background:done?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?<span style={{fontSize:10,color:"#FFF",fontWeight:700}}>✓</span>:<span style={{fontSize:9,color:T.inkFaint}}>{i+1}</span>}</div><span style={{fontSize:12,color:done?T.inkFaint:T.ink,lineHeight:1.6,textDecoration:done?"line-through":"none"}}>{p}</span></div>);})}</div><div style={{marginTop:20}}>{allDone(item.id)&&!connected[item.id]?<Btn onClick={()=>setConnected(prev=>({...prev,[item.id]:true}))} variant="gold" style={{width:"100%",padding:13}}>✓ MARCAR COMO CONECTADO</Btn>:connected[item.id]?<div style={{padding:11,background:T.greenBg,border:`1.5px solid ${T.green}40`,borderRadius:8,textAlign:"center",fontSize:11,color:T.green,fontWeight:700}}>✓ CONECTADO</div>:<Card style={{padding:"14px 16px",background:T.goldFaint,border:`1px solid ${T.goldBorder}`}}><div style={{fontSize:12,color:T.inkMid,marginBottom:8}}>Complete todos os passos.</div><div style={{height:3,background:T.surfaceMid,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(item.passos.filter((_,idx)=>isSD(item.id,idx)).length/item.passos.length)*100}%`,background:T.gold}}/></div></Card>}</div></div></div>)}
    </div>
  );
}

// ─── Processing ───────────────────────────────────────────────────
export function ScreenProcessing(){
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fB}}><div style={{textAlign:"center",maxWidth:420,padding:32}}><div style={{fontFamily:T.fD,fontSize:52,color:T.gold,marginBottom:8,animation:"pulse 2s ease infinite",lineHeight:1}}>H</div><div style={{fontFamily:T.fD,fontSize:28,color:T.ink,marginBottom:4}}>Sua equipe está se preparando</div><div style={{fontSize:11,color:T.inkFaint,marginBottom:32,letterSpacing:"0.12em"}}>EQUIPE HDOHMANN · CONFIGURANDO SEU PLANO</div><div style={{display:"flex",flexDirection:"column",gap:10}}>{["Ana está montando seu plano de cuidado...","Coach analisando seus objetivos...","Rafael verificando seus medicamentos...","Dra. Clara aguardando seu laudo genético...","Sincronizando com o servidor..."].map((msg,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,boxShadow:T.shadowCard,animation:`fadeUp 0.4s ease ${i*0.45}s both`}}><div style={{width:7,height:7,borderRadius:"50%",background:T.green,animation:`pulse 1.5s ease ${i*0.3}s infinite`,flexShrink:0}}/><span style={{fontSize:12,color:T.inkMid}}>{msg}</span></div>))}</div></div></div>);
}

// ─── ROOT ─────────────────────────────────────────────────────────
