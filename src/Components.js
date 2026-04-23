import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase ─────────────────────────────────────────────────────
const SUPABASE_URL = "https://ahznewkkcyakkilaatas.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoem5ld2trY3lha2tpbGFhdGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTQzMTIsImV4cCI6MjA5MTg3MDMxMn0.4nFFkuhRTNCXFnkSQDjc_JNi0yoHUBUfT4mgcQ2-3ak";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Tema ─────────────────────────────────────────────────────────
const T = {
  bg:         "#F7F6F2",
  bgWarm:     "#F1EFE8",
  surface:    "#FFFFFF",
  ink:        "#2C2C2A",
  inkMid:     "#5F5E5A",
  inkLight:   "#888780",
  inkFaint:   "#AEACA5",
  green:      "#00A868",
  greenDark:  "#1B5E20",
  greenBg:    "#F0F9F4",
  greenBorder:"#C7E6D0",
  blue:       "#185FA5",
  blueBg:     "#E6F1FB",
  red:        "#A32D2D",
  redBg:      "#FCEBEB",
  orange:     "#854F0B",
  orangeBg:   "#FAEEDA",
  purple:     "#5B3FA6",
  purpleBg:   "#F0EBFB",
  border:     "rgba(0,0,0,0.10)",
  borderMid:  "rgba(0,0,0,0.18)",
  shadow:     "0 1px 3px rgba(0,0,0,0.06)",
  shadowMd:   "0 2px 8px rgba(0,0,0,0.10)",
  f: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ─── Helpers ──────────────────────────────────────────────────────
function dataHoje(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function iniciais(nome){
  return (nome||"?").split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();
}

function scoreColor(s){
  return s>=75?T.green:s>=50?T.orange:T.red;
}

// ─── Banco ────────────────────────────────────────────────────────
async function getMedicoId(userId){
  const{data}=await supabase.from("medicos").select("id,nome,crm,especialidade,email").eq("user_id",userId).single();
  return data;
}

async function carregarPacientes(medicoId){
  const{data}=await supabase.from("pacientes")
    .select(`id,nome,email,data_nascimento,sexo,cargo,
      perfis(condicoes,estresse,sono,freq_treino,qualidade_vida),
      checkins(energia,sono,estresse,humor,vinculos,bem_estar,data,sintomas,notas)`)
    .eq("medico_id",medicoId)
    .eq("ativo",true);
  return (data||[]).map(p=>{
    const ci=p.checkins?.sort((a,b)=>b.data>a.data?1:-1)[0];
    const perf=p.perfis?.[0];
    const score=calcScoreSimples(perf,ci);
    return{...p,ultimoCheckin:ci,perfil:perf,score,checkinHoje:ci?.data===dataHoje()};
  });
}

function calcScoreSimples(perf,ci){
  if(!perf&&!ci)return 65;
  let s=65;
  if(ci){
    s=Math.round((
      (ci.energia||5)*10*0.2+
      (ci.sono||5)*10*0.15+
      Math.max(0,(10-(ci.estresse||5))*10)*0.2+
      (ci.humor||5)*10*0.15+
      (ci.vinculos||5)*10*0.15+
      (ci.bem_estar||5)*10*0.15
    ));
  }
  return Math.max(0,Math.min(100,s));
}

async function carregarCheckins(pacienteId,limite=30){
  const{data}=await supabase.from("checkins")
    .select("*")
    .eq("paciente_id",pacienteId)
    .order("data",{ascending:false})
    .limit(limite);
  return data||[];
}

async function carregarMetricasClinicas(medicoId){
  // Documentos dos últimos 90 dias
  const inicio=new Date();inicio.setDate(inicio.getDate()-90);
  const{data:docs}=await supabase.from("documentos")
    .select("tipo,conteudo_json,paciente_id,created_at")
    .eq("medico_id",medicoId)
    .gte("created_at",inicio.toISOString());

  // Registros do plano dos últimos 30 dias
  const inicio30=new Date();inicio30.setDate(inicio30.getDate()-30);
  const{data:regs}=await supabase.from("plano_registros")
    .select("paciente_id,tarefa_id,data")
    .gte("data",inicio30.toISOString().slice(0,10));

  // Plano de cuidado ativo dos pacientes do médico
  const{data:plano}=await supabase.from("plano_cuidado")
    .select("paciente_id,frequencia_tipo,meta_semanal,ativo")
    .eq("medico_id",medicoId)
    .eq("ativo",true);

  return{docs:docs||[],regs:regs||[],plano:plano||[]};
}

async function carregarAgendamentos(medicoId){
  const{data}=await supabase.from("agendamentos")
    .select("*,pacientes(id,nome)")
    .eq("medico_id",medicoId)
    .gte("data",dataHoje())
    .order("data").order("hora");
  return data||[];
}

async function carregarAgendamentosPaciente(pacienteId){
  const{data}=await supabase.from("agendamentos")
    .select("*")
    .eq("paciente_id",pacienteId)
    .order("data",{ascending:false});
  return data||[];
}

async function salvarAgendamento(ag){
  const{data,error}=await supabase.from("agendamentos").insert(ag).select("id").single();
  return{data,error};
}

async function salvarBloqueio(bloqueio){
  const{data,error}=await supabase.from("agendamentos").insert({
    ...bloqueio,
    tipo:"bloqueado",
    status:"bloqueado",
    resumo:bloqueio.motivo||"Indisponível",
  }).select("id").single();
  return{data,error};
}

async function carregarDocumentos(pacienteId){
  const{data}=await supabase.from("documentos")
    .select("*")
    .eq("paciente_id",pacienteId)
    .order("created_at",{ascending:false});
  return data||[];
}

async function salvarDocumento(doc){
  const{data,error}=await supabase.from("documentos").insert(doc).select("id").single();
  return{data,error};
}

async function carregarDiagnosticos(pacienteId){
  const{data}=await supabase.from("diagnosticos")
    .select("*")
    .eq("paciente_id",pacienteId)
    .order("created_at",{ascending:false});
  return data||[];
}

async function salvarDiagnostico(diag){
  const{data,error}=await supabase.from("diagnosticos").insert(diag).select("id").single();
  return{data,error};
}

async function carregarMedicamentosPaciente(pacienteId){
  const{data}=await supabase.from("documentos")
    .select("id,data,conteudo_json,created_at")
    .eq("paciente_id",pacienteId)
    .eq("tipo","receita")
    .order("data",{ascending:false});
  return(data||[]).map(d=>{
    const c=d.conteudo_json;
    const parsed=typeof c==="string"?JSON.parse(c):c;
    return{...d,medicamentos:parsed?.medicamentos||[],conduta:parsed?.conduta||""};
  });
}

async function carregarEstiloVidaPaciente(pacienteId){
  const{data}=await supabase.from("documentos")
    .select("id,data,conteudo_json,created_at")
    .eq("paciente_id",pacienteId)
    .eq("tipo","estilo_vida")
    .order("data",{ascending:false});
  return(data||[]).map(d=>{
    const c=d.conteudo_json;
    const parsed=typeof c==="string"?JSON.parse(c):c;
    return{...d,estiloVida:parsed?.estiloVida||[],conduta:parsed?.conduta||""};
  });
}

async function carregarExamesPaciente(pacienteId){
  const{data}=await supabase.from("documentos")
    .select("id,data,conteudo_json,created_at")
    .eq("paciente_id",pacienteId)
    .eq("tipo","pedido_exame")
    .order("data",{ascending:false});
  return(data||[]).map(d=>{
    const c=d.conteudo_json;
    const parsed=typeof c==="string"?JSON.parse(c):c;
    return{...d,exames:parsed?.exames||[],conduta:parsed?.conduta||""};
  });
}

async function carregarPlanoPaciente(pacienteId){
  const{data}=await supabase.from("plano_cuidado")
    .select("*")
    .eq("paciente_id",pacienteId)
    .order("created_at",{ascending:false});
  return data||[];
}

async function carregarRegistrosPlano(pacienteId){
  const hoje=dataHoje();
  const inicio=new Date();inicio.setDate(inicio.getDate()-30);
  const inicioStr=inicio.toISOString().slice(0,10);
  const{data}=await supabase.from("plano_registros")
    .select("*")
    .eq("paciente_id",pacienteId)
    .gte("data",inicioStr)
    .order("data",{ascending:false});
  return data||[];
}

async function salvarTarefaPlano(tarefa){
  const{data,error}=await supabase.from("plano_cuidado").insert(tarefa).select("id").single();
  return{data,error};
}

async function carregarEpisodiosDisponiveis(){
  const{data}=await supabase.from("episodios")
    .select("id,nome,cid_principal,duracao_meses,renovavel,versao")
    .eq("publicado",true)
    .eq("ativo",true)
    .order("nome");
  return data||[];
}

async function carregarEpisodosPaciente(pacienteId){
  const{data}=await supabase.from("paciente_episodios")
    .select("*, episodios(id,nome,cid_principal,duracao_meses,renovavel,ichom_set, episodio_acoes(*), episodio_desfechos(*))")
    .eq("paciente_id",pacienteId)
    .order("created_at",{ascending:false});
  return data||[];
}

async function vincularEpisodio(pacienteId,episodioId,medicoId,dataInicio,duracaoMeses){
  const dataFim=new Date(dataInicio);
  dataFim.setMonth(dataFim.getMonth()+duracaoMeses);

  // Criar vínculo
  const{data:pe,error}=await supabase.from("paciente_episodios").insert({
    paciente_id:pacienteId,
    episodio_id:episodioId,
    medico_id:medicoId,
    data_inicio:dataInicio,
    data_fim_prevista:dataFim.toISOString().slice(0,10),
    status:"ativo",
    numero_ciclo:1,
  }).select("id").single();

  if(error||!pe)return{data:pe,error};

  // Carregar ações do episódio
  const{data:acoes}=await supabase.from("episodio_acoes")
    .select("*")
    .eq("episodio_id",episodioId)
    .order("dia_inicio");

  if(!acoes||acoes.length===0)return{data:pe,error:null};

  // Determinar quais tarefas criar no plano:
  // 1. Todas as tarefas cujo dia já chegou (dia_inicio <= hoje em dias desde início)
  // 2. A próxima tarefa futura
  const hoje=new Date();
  const ini=new Date(dataInicio+"T12:00:00");
  const diasPassados=Math.floor((hoje-ini)/(1000*60*60*24));

  const ativasHoje=acoes.filter(a=>(a.dia_inicio||0)<=diasPassados);
  const futuras=acoes.filter(a=>(a.dia_inicio||0)>diasPassados).sort((a,b)=>(a.dia_inicio||0)-(b.dia_inicio||0));
  const proxima=futuras[0]; // só a próxima

  const tarefasParaCriar=[...ativasHoje,...(proxima?[proxima]:[])];

  const FREQ_MAP={consulta:"unico",exame:"unico",medicamento:"diario",estilo_vida:"diario",questionario:"unico",outro:"unico"};
  const AREA_MAP={consulta:"saude",exame:"saude",medicamento:"saude",estilo_vida:"bem_estar",questionario:"saude",outro:"saude"};

  if(tarefasParaCriar.length>0){
    await supabase.from("plano_cuidado").insert(tarefasParaCriar.map(a=>({
      paciente_id:pacienteId,
      medico_id:medicoId,
      titulo:a.titulo,
      descricao:a.descricao||null,
      frequencia:FREQ_MAP[a.tipo]||"unico",
      frequencia_tipo:FREQ_MAP[a.tipo]||"unico",
      meta:String(a.meta_semanal||1),
      meta_semanal:a.meta_semanal||1,
      area:AREA_MAP[a.tipo]||"saude",
      categoria:"episodio",
      origem:"sistema",
      ativo:true,
      // Metadados para rastrear origem
      consulta_id:null,
      // Guardar referência ao episódio e ação
      episodio_acao_id:a.id,
      paciente_episodio_id:pe.id,
      visivel_a_partir:a.dia_inicio===proxima?.dia_inicio&&proxima?"proxima":"agora",
    })));
  }

  return{data:pe,error:null};
}

async function carregarDesfechos(pacienteId){
  const{data}=await supabase.from("desfechos_registros")
    .select("*,desfechos_config(titulo,tipo,meta_max,meta_min)")
    .eq("paciente_id",pacienteId)
    .order("data",{ascending:false});
  return data||[];
}

async function salvarDesfecho(reg){
  const{error}=await supabase.from("desfechos_registros").insert(reg);
  return!error;
}

// ─── UI Primitives ────────────────────────────────────────────────
function Card({children,style={},onClick}){
  const[h,setH]=useState(false);
  return(
    <div onClick={onClick}
      onMouseOver={()=>onClick&&setH(true)}
      onMouseOut={()=>onClick&&setH(false)}
      style={{background:T.surface,borderRadius:12,border:`0.5px solid ${T.border}`,
        boxShadow:h?T.shadowMd:T.shadow,transition:"all 0.15s",
        cursor:onClick?"pointer":"default",...style}}>
      {children}
    </div>
  );
}

function Btn({children,onClick,variant="primary",disabled=false,style={},small=false}){
  const v={
    primary:{background:T.green,color:"#FFF",border:"none"},
    outline:{background:T.surface,color:T.inkMid,border:`0.5px solid ${T.borderMid}`},
    danger:{background:T.red,color:"#FFF",border:"none"},
    blue:{background:T.blue,color:"#FFF",border:"none"},
    ghost:{background:"transparent",color:T.inkLight,border:"none"},
  };
  return(
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{padding:small?"6px 12px":"9px 18px",borderRadius:8,fontFamily:T.f,
        fontSize:small?11:13,fontWeight:500,cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.4:1,transition:"all 0.15s",...(v[variant]||v.primary),...style}}>
      {children}
    </button>
  );
}

function Badge({label,color=T.green,bg}){
  return(
    <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,
      background:bg||`${color}15`,color,fontWeight:500,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

function Lbl({children,color}){
  return(
    <div style={{fontSize:10,letterSpacing:"0.1em",color:color||T.inkLight,
      textTransform:"uppercase",marginBottom:6,fontWeight:500}}>
      {children}
    </div>
  );
}

function Avatar({nome,size=36,color=T.green}){
  const i=iniciais(nome);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",
      background:`${color}15`,border:`1.5px solid ${color}30`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.35,color,fontWeight:600,flexShrink:0}}>
      {i}
    </div>
  );
}

function ScoreRing({value,size=52}){
  const r=size/2-5,circ=2*Math.PI*r;
  const pct=Math.max(0,Math.min(100,value||0));
  const dash=(pct/100)*circ;
  const cor=scoreColor(pct);
  return(
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.bgWarm} strokeWidth={size*0.09}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cor} strokeWidth={size*0.09}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={cor} fontSize={size*0.3} fontWeight="700" fontFamily={T.f}>{pct}</text>
    </svg>
  );
}

function Spinner(){
  return(
    <div style={{width:28,height:28,border:`3px solid ${T.border}`,
      borderTop:`3px solid ${T.green}`,borderRadius:"50%",
      animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
  );
}

function Input({label,value,onChange,placeholder,type="text",unit,autoFocus}){
  const[f,setF]=useState(false);
  return(
    <div>
      {label&&<Lbl>{label}</Lbl>}
      <div style={{position:"relative"}}>
        <input type={type} value={value||""} onChange={e=>onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus}
          onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{width:"100%",padding:unit?"10px 48px 10px 12px":"10px 12px",
            border:`1px solid ${f?T.green:T.border}`,borderRadius:8,
            background:T.surface,fontFamily:T.f,fontSize:13,color:T.ink,
            outline:"none",boxSizing:"border-box"}}/>
        {unit&&<span style={{position:"absolute",right:12,top:"50%",
          transform:"translateY(-50%)",fontSize:11,color:T.inkLight}}>{unit}</span>}
      </div>
    </div>
  );
}

function Select({label,value,onChange,options}){
  return(
    <div>
      {label&&<Lbl>{label}</Lbl>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,
          borderRadius:8,background:T.surface,fontFamily:T.f,fontSize:13,
          color:T.ink,outline:"none"}}>
        {options.map(o=>(
          <option key={o.value||o} value={o.value||o}>{o.label||o}</option>
        ))}
      </select>
    </div>
  );
}

function Textarea({label,value,onChange,placeholder,rows=4}){
  const[f,setF]=useState(false);
  return(
    <div>
      {label&&<Lbl>{label}</Lbl>}
      <textarea value={value||""} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{width:"100%",padding:"10px 12px",border:`1px solid ${f?T.green:T.border}`,
          borderRadius:8,background:T.surface,fontFamily:T.f,fontSize:13,color:T.ink,
          outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────
export function ScreenLogin({onLogin}){
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);

  const handleLogin=async()=>{
    if(!email||!pass){setErr("Preencha todos os campos.");return;}
    setLoading(true);setErr("");
    const{data,error}=await supabase.auth.signInWithPassword({email,password:pass});
    if(error){setErr("E-mail ou senha incorretos.");setLoading(false);return;}
    const medico=await getMedicoId(data.user.id);
    if(!medico){setErr("Usuário não encontrado como médico.");setLoading(false);return;}
    onLogin({userId:data.user.id,...medico});
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.f,padding:24}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:40,justifyContent:"center"}}>
          <div style={{width:32,height:32,borderRadius:8,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:600,fontSize:15}}>V</div>
          <span style={{fontSize:18,fontWeight:500,color:T.ink}}>Hospital Virtual Verde</span>
        </div>
        <Card style={{padding:"32px"}}>
          <div style={{fontSize:22,fontWeight:500,color:T.ink,marginBottom:4}}>Painel Médico</div>
          <div style={{fontSize:13,color:T.inkMid,marginBottom:24}}>Acesse com suas credenciais HVV</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Input label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" autoFocus/>
            <Input label="Senha" value={pass} onChange={setPass} placeholder="••••••••" type="password"/>
            {err&&<div style={{fontSize:12,color:T.red,padding:"8px 12px",background:T.redBg,borderRadius:6}}>{err}</div>}
            <Btn onClick={handleLogin} disabled={loading} style={{width:"100%",marginTop:4}}>
              {loading?"Entrando...":"Entrar →"}
            </Btn>
          </div>
        </Card>
        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:T.inkFaint}}>
          Credenciais fornecidas pela equipe HVV
        </div>
      </div>
    </div>
  );
}

// ─── App Principal ────────────────────────────────────────────────
export function AppMedico({medico,apiKey,onLogout}){
  const[tela,setTela]=useState("dashboard");
  const[pacientes,setPacientes]=useState([]);
  const[pacSelecionado,setPacSelecionado]=useState(null);
  const[agendamentoAtivo,setAgendamentoAtivo]=useState(null);
  const[agenda,setAgenda]=useState([]);
  const[metricas,setMetricas]=useState({docs:[],regs:[],plano:[]});
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!medico?.id)return;
    Promise.all([
      carregarPacientes(medico.id).then(setPacientes),
      carregarAgendamentos(medico.id).then(setAgenda),
      carregarMetricasClinicas(medico.id).then(setMetricas),
    ]).finally(()=>setLoading(false));
  },[medico?.id]);

  const[consultaEmAndamento,setConsultaEmAndamento]=useState(false);

  const abrirPaciente=(pac,ag=null)=>{
    // Se ag passado (vem da agenda/dashboard = iniciar consulta)
    // e já há consulta em andamento, bloquear
    if(ag&&consultaEmAndamento){
      alert("Há uma consulta em andamento. Encerre a consulta atual antes de iniciar uma nova.");
      return;
    }
    setPacSelecionado(pac);
    setAgendamentoAtivo(ag);
    setTela("paciente");
  };
  const voltarLista=()=>{setTela("pacientes");setPacSelecionado(null);setAgendamentoAtivo(null);};
  const onConsultaIniciada=()=>setConsultaEmAndamento(true);
  const onConsultaEncerrada=()=>setConsultaEmAndamento(false);

  const alertas=pacientes.filter(p=>p.score<50||(p.ultimoCheckin?.estresse>=8));
  const checkinHoje=pacientes.filter(p=>p.checkinHoje).length;
  const scoreMedia=pacientes.length?Math.round(pacientes.reduce((a,p)=>a+p.score,0)/pacientes.length):0;

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:"◈"},
    {id:"pacientes",label:"Pacientes",icon:"👥",badge:alertas.length>0?alertas.length:null,badgeColor:T.red},
    {id:"agenda",label:"Agenda",icon:"📅",badge:agenda.filter(a=>a.data===dataHoje()).length||null},
    {id:"literatura",label:"Literatura",icon:"🔬"},
  ];

  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,fontFamily:T.f,overflow:"hidden"}}>

      {/* Sidebar */}
      <div style={{width:220,flexShrink:0,borderRight:`0.5px solid ${T.border}`,display:"flex",flexDirection:"column",background:T.surface,height:"100vh",position:"sticky",top:0}}>

        {/* Logo */}
        <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:500,fontSize:13}}>V</div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Hospital Virtual Verde</div>
            <div style={{fontSize:10,color:T.inkFaint}}>Painel Médico</div>
          </div>
        </div>

        {/* Médico */}
        <div style={{padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
          <Avatar nome={medico.nome} size={34}/>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{medico.nome}</div>
            <div style={{fontSize:11,color:T.inkLight}}>{medico.especialidade||"Clínica Geral"}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,overflowY:"auto",padding:"8px"}}>
          {NAV.map(m=>{
            const active=tela===m.id||(tela==="paciente"&&m.id==="pacientes");
            return(
              <button key={m.id}
                onClick={()=>{setTela(m.id);if(m.id!=="paciente")setPacSelecionado(null);}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                  borderRadius:8,background:active?T.greenBg:"transparent",border:"none",
                  cursor:"pointer",fontFamily:T.f,textAlign:"left",marginBottom:1,transition:"all 0.15s"}}
                onMouseOver={e=>{if(!active)e.currentTarget.style.background=T.bgWarm;}}
                onMouseOut={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>{m.icon}</span>
                <span style={{fontSize:13,color:active?T.greenDark:T.inkMid,fontWeight:active?500:400,flex:1}}>{m.label}</span>
                {m.badge&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:m.badgeColor||T.green,color:"#FFF",fontWeight:600}}>{m.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{padding:"12px 16px",borderTop:`0.5px solid ${T.border}`}}>
          <button onClick={onLogout} style={{width:"100%",padding:"7px",background:"transparent",border:`0.5px solid ${T.borderMid}`,borderRadius:6,color:T.inkLight,fontFamily:T.f,fontSize:12,cursor:"pointer"}}>Sair</button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Topbar */}
        <div style={{borderBottom:`0.5px solid ${T.border}`,padding:"0 24px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {tela==="paciente"&&pacSelecionado&&(
              <button onClick={voltarLista} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.inkMid,display:"flex",alignItems:"center",gap:4}}>
                ← Pacientes
              </button>
            )}
            {tela==="paciente"&&pacSelecionado&&<span style={{color:T.border}}>›</span>}
            <span style={{fontSize:13,color:T.ink,fontWeight:500}}>
              {tela==="paciente"&&pacSelecionado?pacSelecionado.nome:NAV.find(n=>n.id===tela)?.label||""}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:T.green}}/>
            <span style={{fontSize:12,color:T.inkLight}}>Online</span>
          </div>
        </div>

        {/* Telas */}
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {loading?(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Spinner/>
            </div>
          ):(
            <>
              {tela==="dashboard"&&<TelaDashboard medico={medico} pacientes={pacientes} agenda={agenda} scoreMedia={scoreMedia} checkinHoje={checkinHoje} alertas={alertas} onAbrirPaciente={abrirPaciente} onIrAgenda={()=>setTela("agenda")} metricas={metricas}/>}
              {tela==="pacientes"&&<TelaPacientes pacientes={pacientes} onAbrir={abrirPaciente}/>}
              {tela==="paciente"&&pacSelecionado&&<TelaPaciente pac={pacSelecionado} medico={medico} apiKey={apiKey} agendamentoInicial={agendamentoAtivo} onVoltar={voltarLista} onConsultaIniciada={onConsultaIniciada} onConsultaEncerrada={onConsultaEncerrada}/>}
              {tela==="agenda"&&<TelaAgenda medico={medico} agenda={agenda} pacientes={pacientes} onAtualizar={()=>carregarAgendamentos(medico.id).then(setAgenda)} onAbrirPaciente={abrirPaciente}/>}
              {tela==="literatura"&&<TelaLiteratura apiKey={apiKey}/>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────
function TelaDashboard({medico,pacientes,agenda,scoreMedia,checkinHoje,alertas,onAbrirPaciente,onIrAgenda,metricas={}}){
  const agendaHoje=agenda.filter(a=>a.data===dataHoje());
  const hora=new Date().getHours();
  const saudacao=hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";
  const VAGAS=50;
  const pctCarteira=Math.round((pacientes.length/VAGAS)*100);

  // ── Métricas clínicas ──────────────────────────────────────────
  const docs=metricas.docs||[];
  const regs=metricas.regs||[];
  const plano=metricas.plano||[];

  // Exames por consulta
  const consultasDocs=docs.filter(d=>d.tipo==="consulta");
  const examesDocs=docs.filter(d=>d.tipo==="pedido_exame");
  const totalExames=examesDocs.reduce((acc,d)=>{
    const c=d.conteudo_json;
    const p=typeof c==="string"?JSON.parse(c||"{}"):c||{};
    return acc+(p.exames?.length||1);
  },0);
  const mediaExamesPorConsulta=consultasDocs.length>0?
    (totalExames/consultasDocs.length).toFixed(1):"—";

  // Medicamentos únicos prescritos
  const medsPrescritos=new Set();
  docs.filter(d=>d.tipo==="receita").forEach(d=>{
    const c=d.conteudo_json;
    const p=typeof c==="string"?JSON.parse(c||"{}"):c||{};
    (p.medicamentos||[]).forEach(m=>{if(m.nome)medsPrescritos.add(m.nome.toLowerCase().trim());});
  });
  const totalMedsUnicos=medsPrescritos.size;

  // Adesão ao plano — % de dias com registro vs esperado
  const calcAdesaoGeral=()=>{
    if(plano.length===0||regs.length===0)return null;
    const esperado=plano.filter(t=>t.frequencia_tipo==="diario").length*30+
      plano.filter(t=>t.frequencia_tipo==="n_vezes_semana").reduce((a,t)=>a+(t.meta_semanal||3)*4,0);
    if(esperado===0)return null;
    return Math.min(100,Math.round((regs.length/esperado)*100));
  };
  const adesaoGeral=calcAdesaoGeral();

  // Adesão por paciente
  const adesaoPorPaciente=pacientes.map(p=>{
    const planoP=plano.filter(t=>t.paciente_id===p.id);
    const regsP=regs.filter(r=>r.paciente_id===p.id);
    if(planoP.length===0)return{...p,adesao:null};
    const esp=planoP.filter(t=>t.frequencia_tipo==="diario").length*30;
    const adesao=esp>0?Math.min(100,Math.round((regsP.length/esp)*100)):null;
    return{...p,adesao};
  }).filter(p=>p.adesao!==null).sort((a,b)=>a.adesao-b.adesao);

  // Score médio por eixo
  const eixoMedia=(key)=>{
    const vals=pacientes.map(p=>p.ultimoCheckin?.[key]).filter(v=>v!=null);
    return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10):0;
  };
  const eixos=[
    {label:"Energia",key:"energia",cor:T.green},
    {label:"Sono",key:"sono",cor:T.blue},
    {label:"Estresse",key:"estresse",cor:T.red,inv:true},
    {label:"Humor",key:"humor",cor:T.orange},
    {label:"Vínculos",key:"vinculos",cor:T.purple},
    {label:"Bem-estar",key:"bem_estar",cor:T.green},
  ].map(e=>({...e,media:eixoMedia(e.key)}));
  const eixoCritico=eixos.slice().sort((a,b)=>a.media-b.media)[0];

  return(
    <div style={{flex:1,overflowY:"auto",padding:"28px"}}>
      <div style={{maxWidth:1060,margin:"0 auto"}}>

        {/* Cabeçalho */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div>
            <div style={{fontSize:24,fontWeight:500,color:T.ink,marginBottom:4}}>{saudacao}, {medico.nome.split(" ")[0]}.</div>
            <div style={{fontSize:13,color:T.inkMid}}>
              {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
              {agendaHoje.length>0&&<span> · {agendaHoje.length} consultas hoje</span>}
              {alertas.length>0&&<span style={{color:T.red}}> · {alertas.length} alertas ativos</span>}
            </div>
          </div>
          <Btn onClick={onIrAgenda} variant="outline" style={{fontSize:12}}>📅 Ver agenda completa</Btn>
        </div>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          {/* Carteira */}
          <Card style={{padding:"16px 18px"}}>
            <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:6}}>CARTEIRA</div>
            <div style={{fontSize:26,fontWeight:600,color:T.green,lineHeight:1,marginBottom:3}}>{pacientes.length}<span style={{fontSize:14,color:T.inkFaint,fontWeight:400}}>/{VAGAS}</span></div>
            <div style={{fontSize:11,color:T.inkMid,marginBottom:8}}>{VAGAS-pacientes.length} vagas disponíveis</div>
            <div style={{height:4,background:T.bgWarm,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pctCarteira}%`,background:pctCarteira>90?T.red:pctCarteira>75?T.orange:T.green,borderRadius:2}}/>
            </div>
            <div style={{fontSize:10,color:T.inkFaint,marginTop:4}}>{pctCarteira}% ocupado</div>
          </Card>
          {[
            {label:"Score médio",value:`${scoreMedia}/100`,sub:"↑ vitalidade geral",cor:scoreColor(scoreMedia)},
            {label:"Check-ins hoje",value:`${checkinHoje}/${pacientes.length}`,sub:`${pacientes.length-checkinHoje} ainda não fizeram`,cor:T.blue},
            {label:"Alertas",value:alertas.length,sub:alertas.length>0?"requerem atenção":"tudo controlado",cor:alertas.length>0?T.red:T.green},
          ].map((k,i)=>(
            <Card key={i} style={{padding:"16px 18px"}}>
              <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:6}}>{k.label.toUpperCase()}</div>
              <div style={{fontSize:26,fontWeight:600,color:k.cor,lineHeight:1,marginBottom:3}}>{k.value}</div>
              <div style={{fontSize:11,color:T.inkMid}}>{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Score por eixo da carteira */}
        <Card style={{padding:"16px 20px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:500,color:T.ink}}>Score da carteira por eixo</div>
            <div style={{fontSize:11,color:T.inkMid}}>média de {pacientes.filter(p=>p.ultimoCheckin).length} pacientes com check-in</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:10}}>
            {eixos.map(e=>(
              <div key={e.key} style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:T.inkMid,marginBottom:6}}>{e.label}</div>
                <div style={{height:48,background:T.bgWarm,borderRadius:6,overflow:"hidden",display:"flex",alignItems:"flex-end",marginBottom:4}}>
                  <div style={{width:"100%",height:`${e.media}%`,background:e.cor,opacity:0.75,transition:"height 0.4s"}}/>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:e.cor}}>{e.media}</div>
              </div>
            ))}
          </div>
          {eixoCritico&&(
            <div style={{fontSize:12,color:T.inkMid,padding:"8px 12px",background:T.bgWarm,borderRadius:6}}>
              <strong style={{color:eixoCritico.cor}}>{eixoCritico.label} ({eixoCritico.media})</strong> é o eixo mais crítico da carteira
              {" — "}{pacientes.filter(p=>(p.ultimoCheckin?.[eixoCritico.key]||0)<5).length} pacientes abaixo de 5/10.
            </div>
          )}
        </Card>

        {/* ── Métricas clínicas ─────────────────────────────────── */}
        <Card style={{padding:"18px 20px",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:14}}>Métricas clínicas · últimos 90 dias</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:adesaoPorPaciente.length>0?16:0}}>

            {/* Adesão geral */}
            <div style={{padding:"14px 16px",background:T.bgWarm,borderRadius:10,borderLeft:`3px solid ${adesaoGeral===null?T.border:adesaoGeral>=70?T.green:adesaoGeral>=40?T.orange:T.red}`}}>
              <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:6}}>ADESÃO AO PLANO</div>
              <div style={{fontSize:28,fontWeight:700,color:adesaoGeral===null?T.inkFaint:adesaoGeral>=70?T.green:adesaoGeral>=40?T.orange:T.red,marginBottom:2}}>
                {adesaoGeral===null?"—":adesaoGeral+"%"}
              </div>
              <div style={{fontSize:11,color:T.inkMid}}>média da carteira · 30 dias</div>
            </div>

            {/* Exames por consulta */}
            <div style={{padding:"14px 16px",background:T.bgWarm,borderRadius:10,borderLeft:`3px solid ${T.blue}`}}>
              <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:6}}>EXAMES / CONSULTA</div>
              <div style={{fontSize:28,fontWeight:700,color:T.blue,marginBottom:2}}>{mediaExamesPorConsulta}</div>
              <div style={{fontSize:11,color:T.inkMid}}>{totalExames} exames · {consultasDocs.length} consultas</div>
            </div>

            {/* Medicamentos únicos */}
            <div style={{padding:"14px 16px",background:T.bgWarm,borderRadius:10,borderLeft:`3px solid ${T.purple}`}}>
              <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:6}}>MEDICAMENTOS ÚNICOS</div>
              <div style={{fontSize:28,fontWeight:700,color:T.purple,marginBottom:2}}>{totalMedsUnicos||"—"}</div>
              <div style={{fontSize:11,color:T.inkMid}}>diferentes prescritos</div>
            </div>
          </div>

          {/* Adesão por paciente */}
          {adesaoPorPaciente.length>0&&(
            <div>
              <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:10}}>ADESÃO INDIVIDUAL — 30 DIAS</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {adesaoPorPaciente.slice(0,6).map(p=>(
                  <div key={p.id} onClick={()=>onAbrirPaciente(p)}
                    style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"6px 8px",borderRadius:8,transition:"background 0.12s"}}
                    onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <Avatar nome={p.nome} size={24} color={p.adesao>=70?T.green:p.adesao>=40?T.orange:T.red}/>
                    <div style={{flex:1,fontSize:12,color:T.ink}}>{p.nome}</div>
                    {/* Barra de progresso */}
                    <div style={{width:100,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:p.adesao+"%",height:"100%",borderRadius:3,
                        background:p.adesao>=70?T.green:p.adesao>=40?T.orange:T.red,transition:"width 0.4s"}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:500,width:36,textAlign:"right",
                      color:p.adesao>=70?T.green:p.adesao>=40?T.orange:T.red}}>
                      {p.adesao}%
                    </div>
                  </div>
                ))}
                {adesaoPorPaciente.length>6&&(
                  <div style={{fontSize:11,color:T.inkFaint,textAlign:"center",paddingTop:4}}>
                    +{adesaoPorPaciente.length-6} pacientes com dados de adesão
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

          {/* Alertas detalhados */}
          <Card style={{padding:"0",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Alertas que precisam de atenção</div>
              <span style={{fontSize:12,color:T.blue,cursor:"pointer"}}>Ver todos →</span>
            </div>
            {alertas.length===0?(
              <div style={{padding:"24px",textAlign:"center",color:T.inkFaint,fontSize:13}}>✓ Nenhum alerta no momento</div>
            ):(
              alertas.slice(0,4).map(p=>{
                const critico=p.score<40||(p.ultimoCheckin?.estresse>=9);
                const desc=p.score<50
                  ?`Score ${p.score}/100 · ${(p.perfil?.condicoes||[]).filter(c=>c!=="Nenhuma").slice(0,2).join(" + ")||"—"}`
                  :`Estresse: ${p.ultimoCheckin?.estresse}/10 · ${(p.perfil?.condicoes||[]).filter(c=>c!=="Nenhuma").slice(0,1).join("")||"—"}`;
                return(
                  <div key={p.id} onClick={()=>onAbrirPaciente(p)}
                    style={{padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,cursor:"pointer",transition:"background 0.12s"}}
                    onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <Avatar nome={p.nome} size={28} color={critico?T.red:T.orange}/>
                      <div style={{flex:1,fontSize:13,fontWeight:500,color:T.ink}}>{p.nome}</div>
                      <Badge label={critico?"Crítico":"Atenção"} color={critico?T.red:T.orange} bg={critico?T.redBg:T.orangeBg}/>
                    </div>
                    <div style={{fontSize:11,color:T.inkMid,paddingLeft:38}}>{desc}</div>
                  </div>
                );
              })
            )}
          </Card>

          {/* Agenda do dia com botão Iniciar */}
          <Card style={{padding:"0",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Consultas de hoje</div>
              <Badge label={`${agendaHoje.length}`} color={T.green} bg={T.greenBg}/>
            </div>
            {agendaHoje.length===0?(
              <div style={{padding:"24px",textAlign:"center",color:T.inkFaint,fontSize:13}}>Nenhuma consulta agendada hoje</div>
            ):(
              agendaHoje.map(ag=>(
                <div key={ag.id} style={{padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{textAlign:"center",width:40,flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.ink}}>{ag.hora?.slice(0,5)}</div>
                    <div style={{fontSize:10,color:T.inkFaint}}>{ag.tipo==="teleconsulta"?"📹":"🏥"}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{ag.pacientes?.nome||"—"}</div>
                    <div style={{fontSize:11,color:T.inkMid,textTransform:"capitalize"}}>{ag.tipo} · {ag.duracao||30}min</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <Badge
                      label={ag.status==="agendado"?"Confirmado":ag.status==="remarcacao_pendente"?"Remarcar":ag.status==="cancelado"?"Cancelado":"Confirmado"}
                      color={ag.status==="cancelado"?T.red:ag.status==="remarcacao_pendente"?T.orange:T.green}
                      bg={ag.status==="remarcacao_pendente"?T.orangeBg:undefined}/>
                    {ag.status!=="remarcacao_pendente"&&(
                      <Btn small variant="primary" onClick={()=>onAbrirPaciente(pacientes.find(p=>p.id===ag.paciente_id)||{id:ag.paciente_id,nome:ag.pacientes?.nome},ag)}>
                        Iniciar →
                      </Btn>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Check-ins de hoje */}
          <Card style={{padding:"0",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`}}>
              <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Check-ins de hoje</div>
            </div>
            {pacientes.filter(p=>p.checkinHoje).slice(0,5).map(p=>(
              <div key={p.id} onClick={()=>onAbrirPaciente(p)}
                style={{padding:"10px 18px",borderBottom:`0.5px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}
                onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <Avatar nome={p.nome} size={28}/>
                <div style={{flex:1,fontSize:13,color:T.ink}}>{p.nome}</div>
                <div style={{display:"flex",gap:8}}>
                  {[["E",p.ultimoCheckin?.energia,T.green],["S",p.ultimoCheckin?.sono,T.blue],["Est",p.ultimoCheckin?.estresse,T.red]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:9,color:T.inkFaint}}>{l}</div>
                      <div style={{fontSize:12,fontWeight:600,color:c}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {checkinHoje===0&&<div style={{padding:"24px",textAlign:"center",color:T.inkFaint,fontSize:13}}>Nenhum check-in recebido hoje</div>}
          </Card>

          {/* Sem check-in */}
          <Card style={{padding:"0",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Sem check-in hoje</div>
              <Badge label={`${pacientes.filter(p=>!p.checkinHoje).length}`} color={T.orange} bg={T.orangeBg}/>
            </div>
            {pacientes.filter(p=>!p.checkinHoje).slice(0,5).map(p=>(
              <div key={p.id} onClick={()=>onAbrirPaciente(p)}
                style={{padding:"10px 18px",borderBottom:`0.5px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}
                onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <Avatar nome={p.nome} size={28} color={T.orange}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.ink}}>{p.nome}</div>
                  <div style={{fontSize:11,color:T.inkFaint}}>{(p.perfil?.condicoes||[]).filter(c=>c!=="Nenhuma").slice(0,2).join(", ")||"—"}</div>
                </div>
                <ScoreRing value={p.score} size={32}/>
              </div>
            ))}
          </Card>

        </div>
      </div>
    </div>
  );
}

// ─── Lista de Pacientes ───────────────────────────────────────────
function TelaPacientes({pacientes,onAbrir}){
  const[busca,setBusca]=useState("");
  const[filtro,setFiltro]=useState("todos");

  const lista=pacientes.filter(p=>{
    const ok=p.nome?.toLowerCase().includes(busca.toLowerCase());
    if(filtro==="alertas")return ok&&(p.score<50||p.ultimoCheckin?.estresse>=8);
    if(filtro==="sem-checkin")return ok&&!p.checkinHoje;
    return ok;
  });

  return(
    <div style={{flex:1,overflowY:"auto",padding:"28px"}}>
      <div style={{maxWidth:1060,margin:"0 auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:20,fontWeight:500,color:T.ink}}>Meus Pacientes <span style={{fontSize:14,color:T.inkMid,fontWeight:400}}>({pacientes.length})</span></div>
          <div style={{display:"flex",gap:8}}>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar paciente..."
              style={{padding:"8px 12px",border:`0.5px solid ${T.border}`,borderRadius:8,fontFamily:T.f,fontSize:13,outline:"none",width:200,background:T.surface}}/>
            <select value={filtro} onChange={e=>setFiltro(e.target.value)}
              style={{padding:"8px 12px",border:`0.5px solid ${T.border}`,borderRadius:8,fontFamily:T.f,fontSize:13,outline:"none",background:T.surface,color:T.ink}}>
              <option value="todos">Todos</option>
              <option value="alertas">Com alertas</option>
              <option value="sem-checkin">Sem check-in hoje</option>
              <option value="consulta-semana">Consulta esta semana</option>
            </select>
          </div>
        </div>

        <Card style={{padding:"0",overflow:"hidden"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 80px 1fr 120px 100px 120px",padding:"10px 18px",background:T.bgWarm,borderBottom:`0.5px solid ${T.border}`,fontSize:10,color:T.inkFaint,fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase"}}>
            <div>Paciente</div><div>Score</div><div>Eixos</div><div>Último check-in</div><div>Próx. consulta</div><div>Status</div>
          </div>

          {lista.map(p=>{
            const ci=p.ultimoCheckin;
            const eixos=[ci?.energia,ci?.sono,10-(ci?.estresse||5),ci?.humor,ci?.vinculos,ci?.bem_estar].map(v=>v||5);
            return(
              <div key={p.id} onClick={()=>onAbrir(p)}
                style={{display:"grid",gridTemplateColumns:"2fr 80px 1fr 120px 100px 120px",padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,cursor:"pointer",alignItems:"center",transition:"background 0.12s"}}
                onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Avatar nome={p.nome} size={32} color={p.score<50?T.red:p.score<70?T.orange:T.green}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{p.nome}</div>
                    <div style={{fontSize:11,color:T.inkMid}}>
                      {p.data_nascimento&&`${new Date().getFullYear()-new Date(p.data_nascimento).getFullYear()}a · `}
                      {p.perfil?.condicoes?.filter(c=>c!=="Nenhuma").slice(0,2).join(" · ")||"—"}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:16,fontWeight:700,color:scoreColor(p.score)}}>{p.score}</div>
                <div style={{display:"flex",gap:3,alignItems:"flex-end",height:20}}>
                  {eixos.map((v,i)=>(
                    <div key={i} style={{width:8,height:`${Math.max(2,v*2)}px`,borderRadius:2,background:[T.green,T.blue,T.red,T.orange,T.purple,T.green][i],opacity:0.7}}/>
                  ))}
                </div>
                <div style={{fontSize:12,color:p.checkinHoje?T.green:T.inkFaint}}>
                  {p.checkinHoje?"Hoje ✓":ci?.data?ci.data:"—"}
                </div>
                <div style={{fontSize:12,color:T.inkMid}}>—</div>
                <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                  {p.score<50?(
                    <span style={{fontSize:10,color:T.red}}>⚠️ Score crítico</span>
                  ):p.ultimoCheckin?.estresse>=8?(
                    <span style={{fontSize:10,color:T.orange}}>⚠️ Estresse elevado</span>
                  ):!p.checkinHoje?(
                    <span style={{fontSize:10,color:T.inkFaint}}>⏰ Sem check-in</span>
                  ):(
                    <span style={{fontSize:10,color:T.green}}>✓ Ok</span>
                  )}
                  <span style={{fontSize:12,color:T.blue}}>Ver →</span>
                </div>
              </div>
            );
          })}

          {lista.length===0&&(
            <div style={{padding:"40px",textAlign:"center",color:T.inkFaint,fontSize:13}}>
              Nenhum paciente encontrado
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Ficha do Paciente ────────────────────────────────────────────
function TelaPaciente({pac,medico,apiKey,agendamentoInicial,onVoltar,onConsultaIniciada,onConsultaEncerrada}){
  const[aba,setAba]=useState(agendamentoInicial?"emitir":"checkins");
  const[checkins,setCheckins]=useState([]);
  const[docs,setDocs]=useState([]);
  const[diags,setDiags]=useState([]);
  const[meds,setMeds]=useState([]);
  const[exames,setExames]=useState([]);
  const[estiloVidaDocs,setEstiloVidaDocs]=useState([]);
  const[planoPaciente,setPlanoPaciente]=useState([]);
  const[registrosPlano,setRegistrosPlano]=useState([]);
  const[episodiosPaciente,setEpisodiosPaciente]=useState([]);
  const[agendamentos,setAgendamentos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[consultaAtiva,setConsultaAtiva]=useState(!!agendamentoInicial);
  const[agendamentoConsulta,setAgendamentoConsulta]=useState(agendamentoInicial);
  const[docsConsulta,setDocsConsulta]=useState([]);
  const[confirmarEncerrar,setConfirmarEncerrar]=useState(false);
  const[sugestoesPlano,setSugestoesPlano]=useState([]);
  const[modalPlano,setModalPlano]=useState(false);
  const[salvandoPlano,setSalvandoPlano]=useState(false);

  const gerarSugestoesPlaroEEncerrar=()=>{
    // Verificar se há documentos emitidos
    if(docsConsulta.length===0){
      if(!window.confirm("Nenhum documento foi registrado nesta consulta. Deseja encerrar assim mesmo?\n\nSe esqueceu de registrar algo, clique em Cancelar e use '+ Emitir outro documento'."))return;
      // Encerrar direto sem modal de plano
      setConfirmarEncerrar(true);
      return;
    }
    console.log("[PLANO] docsConsulta:", docsConsulta.length, docsConsulta.map(d=>({tipo:d.tipo,conteudo:d.conteudo_json})));
    const sugestoes=[];

    docsConsulta.forEach(doc=>{
      const c=doc.conteudo_json||{};
      const parsed=typeof c==="string"?JSON.parse(c):c;

      // Medicamentos — array estruturado OU texto livre do campo conduta
      if(parsed.medicamentos?.length>0){
        parsed.medicamentos.forEach(m=>{
          if(!m.nome)return;
          const freq=m.posologia?.includes("2x")||m.posologia?.includes("duas")?"n_vezes_semana":"diario";
          sugestoes.push({
            titulo:"Tomar "+m.nome+(m.dose?" "+m.dose:""),
            descricao:m.posologia||"Conforme prescrição",
            frequencia_tipo:freq,
            meta_semanal:freq==="n_vezes_semana"?14:7,
            categoria:"medicamento",
            icon:"💊",
            incluir:true,
          });
        });
      } else if(doc.tipo==="receita"&&parsed.conduta){
        // Texto livre — criar uma tarefa por linha
        const linhas=parsed.conduta.split("\n").map(l=>l.trim()).filter(l=>l.length>3);
        linhas.forEach(linha=>{
          sugestoes.push({
            titulo:"Tomar: "+linha.slice(0,60),
            descricao:"Conforme prescrição",
            frequencia_tipo:"diario",
            meta_semanal:7,
            categoria:"medicamento",
            icon:"💊",
            incluir:true,
          });
        });
        // Se não tinha quebra de linha, uma tarefa só
        if(linhas.length===0&&parsed.conduta){
          sugestoes.push({
            titulo:"Tomar: "+parsed.conduta.slice(0,60),
            descricao:"Conforme prescrição",
            frequencia_tipo:"diario",
            meta_semanal:7,
            categoria:"medicamento",
            icon:"💊",
            incluir:true,
          });
        }
      }

      // Exames — array estruturado OU texto livre
      if(parsed.exames?.length>0){
        parsed.exames.forEach(e=>{
          if(!e.nome)return;
          sugestoes.push({
            titulo:"Realizar: "+e.nome,
            descricao:e.indicacao||"Conforme solicitação médica",
            frequencia_tipo:"unico",
            meta_semanal:1,
            categoria:"exame",
            icon:"🔬",
            incluir:true,
          });
        });
      } else if(doc.tipo==="pedido_exame"&&parsed.conduta){
        sugestoes.push({
          titulo:"Realizar exame: "+parsed.conduta.slice(0,60),
          descricao:"Conforme solicitação médica",
          frequencia_tipo:"unico",
          meta_semanal:1,
          categoria:"exame",
          icon:"🔬",
          incluir:true,
        });
      }

      // Estilo de vida — array estruturado OU texto livre
      if(parsed.estiloVida?.length>0){
        parsed.estiloVida.forEach(ev=>{
          if(!ev.orientacao)return;
          const isAtiv=ev.categoria==="Atividade física";
          sugestoes.push({
            titulo:ev.orientacao.slice(0,60),
            descricao:ev.categoria||"Orientação médica",
            frequencia_tipo:isAtiv?"n_vezes_semana":"diario",
            meta_semanal:isAtiv?5:7,
            categoria:"estilo_vida",
            icon:ev.categoria==="Alimentação"?"🥗":ev.categoria==="Sono"?"😴":"🏃",
            incluir:true,
          });
        });
      } else if(doc.tipo==="estilo_vida"&&parsed.conduta){
        sugestoes.push({
          titulo:parsed.conduta.slice(0,60),
          descricao:"Orientação de estilo de vida",
          frequencia_tipo:"diario",
          meta_semanal:7,
          categoria:"estilo_vida",
          icon:"🌿",
          incluir:true,
        });
      }

      // Orientações da consulta clínica
      if(doc.tipo==="consulta"&&parsed.orientacoes){
        sugestoes.push({
          titulo:parsed.orientacoes.slice(0,60),
          descricao:"Orientação da consulta",
          frequencia_tipo:"diario",
          meta_semanal:7,
          categoria:"orientacao",
          icon:"📋",
          incluir:false,
        });
      }
    });

    console.log("[PLANO] Sugestões geradas:", sugestoes.length, sugestoes);
    if(sugestoes.length>0){
      setSugestoesPlano(sugestoes);
      setModalPlano(true);
    } else {
      setConfirmarEncerrar(true);
    }
  };

  const handleSalvarPlanoEEncerrar=async()=>{
    setSalvandoPlano(true);
    const incluidas=sugestoesPlano.filter(s=>s.incluir);
    for(const s of incluidas){
      const areaMap={medicamento:"saude",exame:"saude",estilo_vida:"bem_estar",orientacao:"saude"};
      const payload={
        paciente_id:pac.id,
        medico_id:medico.id,
        titulo:s.titulo,
        descricao:s.descricao||"",
        frequencia:s.frequencia_tipo||"diario",
        frequencia_tipo:s.frequencia_tipo||"diario",
        meta:String(s.meta_semanal||7),
        meta_semanal:s.meta_semanal||7,
        area:areaMap[s.categoria]||"saude",
        ativo:true,
        origem:"medico",
        consulta_id:agendamentoConsulta?.id||null,
        categoria:s.categoria||null,
      };
      console.log("[PLANO] Salvando tarefa:", payload);
      const{data,error}=await salvarTarefaPlano(payload);
      if(error)console.warn("[PLANO] Erro ao salvar tarefa:",error.message,error.details,error.hint);
      else console.log("[PLANO] Tarefa salva:", data);
    }
    setSalvandoPlano(false);
    setModalPlano(false);
    // Recarregar plano após salvar
    carregarPlanoPaciente(pac.id).then(setPlanoPaciente);
    setConfirmarEncerrar(true);
  };
  const[avisarSairEmitir,setAvisarSairEmitir]=useState(null); // aba destino
  const[emitirTemConteudo,setEmitirTemConteudo]=useState(false);
  const[confirmarDuplicata,setConfirmarDuplicata]=useState(null); // tipo duplicado
  const topoRef=useRef(null);
  const scrollContainerRef=useRef(null);

  useEffect(()=>{
    Promise.all([
      carregarCheckins(pac.id).then(setCheckins),
      carregarDocumentos(pac.id).then(setDocs),
      carregarDiagnosticos(pac.id).then(setDiags),
      carregarAgendamentosPaciente(pac.id).then(setAgendamentos),
      carregarMedicamentosPaciente(pac.id).then(setMeds),
      carregarExamesPaciente(pac.id).then(setExames),
      carregarEstiloVidaPaciente(pac.id).then(setEstiloVidaDocs),
      carregarPlanoPaciente(pac.id).then(setPlanoPaciente),
      carregarRegistrosPlano(pac.id).then(setRegistrosPlano),
      carregarEpisodosPaciente(pac.id).then(setEpisodiosPaciente),
    ]).finally(()=>setLoading(false));
  },[pac.id]);

  const onDocSalvo=(doc)=>{
    setDocs(prev=>[doc,...prev]);
    if(doc.tipo==="receita")setMeds(prev=>[doc,...prev]);
    if(doc.tipo==="pedido_exame")setExames(prev=>[doc,...prev]);
    if(doc.tipo==="estilo_vida")setEstiloVidaDocs(prev=>[doc,...prev]);
    setDocsConsulta(prev=>[...prev,doc]);
    if(!consultaAtiva){
      setConsultaAtiva(true);
      if(onConsultaIniciada)onConsultaIniciada();
    }
  };

  const onDiagSalvo=(d)=>{
    setDiags(prev=>{
      const jaExiste=prev.some(x=>x.cid===d.cid);
      return jaExiste?prev:[d,...prev];
    });
  };

  const recarregarDiags=useCallback(()=>{
    carregarDiagnosticos(pac.id).then(setDiags);
  },[pac.id]);

  const encerrarConsulta=async()=>{
    // Marcar agendamento como realizado
    const ag=agendamentoConsulta||agendamentos.find(a=>a.data===dataHoje()&&a.status==="agendado");
    if(ag?.id){
      await supabase.from("agendamentos").update({status:"realizada"}).eq("id",ag.id);
      setAgendamentos(prev=>prev.map(a=>a.id===ag.id?{...a,status:"realizada"}:a));
    }
    setConsultaAtiva(false);
    setDocsConsulta([]);
    setConfirmarEncerrar(false);
    setAgendamentoConsulta(null);
    setAba("historico");
    if(onConsultaEncerrada)onConsultaEncerrada();
  };

  const ABAS=[
    {id:"checkins",label:"Check-ins"},
    {id:"historico",label:"Histórico clínico"},
    {id:"emitir",label:"Emitir documento"},
    {id:"diagnosticos",label:"Diagnósticos"},
    {id:"medicamentos",label:"Medicamentos"},
    {id:"exames",label:"Exames"},
    {id:"estilo_vida",label:"Estilo de vida"},
    {id:"episodios",label:"Episódios"},
    {id:"plano",label:"Plano de cuidado"},
    {id:"desfechos",label:"Desfechos"},
    {id:"mensagens",label:"Mensagens"},
  ];

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Header do paciente */}
      <div style={{padding:"16px 24px",borderBottom:`0.5px solid ${T.border}`,background:T.surface,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
          <Avatar nome={pac.nome} size={44} color={scoreColor(pac.score)}/>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:2}}>{pac.nome}</div>
            <div style={{fontSize:12,color:T.inkMid}}>
              {pac.data_nascimento&&(new Date().getFullYear()-new Date(pac.data_nascimento).getFullYear())+"a · "}
              {pac.cargo||"—"} · {pac.perfil?.condicoes?.filter(c=>c!=="Nenhuma").join(", ")||"sem condições registradas"}
            </div>
            {pac.created_at&&<div style={{fontSize:11,color:T.inkFaint}}>Vínculo desde {new Date(pac.created_at).toLocaleDateString("pt-BR")}</div>}
          </div>
          <div style={{textAlign:"center"}}>
            <ScoreRing value={pac.score} size={48}/>
            <div style={{fontSize:10,color:T.inkFaint,marginTop:2}}>Vitalidade</div>
          </div>
        </div>

        {/* Abas */}
        <div style={{display:"flex",gap:0,overflowX:"auto",borderBottom:"none"}}>
          {ABAS.map(a=>(
            <button key={a.id} onClick={()=>{
              if(aba==="emitir"&&emitirTemConteudo&&a.id!=="emitir"){
                setAvisarSairEmitir(a.id);
              } else {
                setAba(a.id);
              }
            }}
              style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${aba===a.id?T.green:"transparent"}`,cursor:"pointer",fontFamily:T.f,fontSize:12,color:aba===a.id?T.green:T.inkMid,fontWeight:aba===a.id?500:400,transition:"all 0.15s",whiteSpace:"nowrap",flexShrink:0}}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div ref={scrollContainerRef} style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {loading?<div style={{textAlign:"center",paddingTop:40}}><Spinner/></div>:(
          <>
            {aba==="checkins"&&<AbaCheckins checkins={checkins} pac={pac}/>}
            {aba==="historico"&&<AbaHistorico agendamentos={agendamentos} docs={docs} medico={medico}/>}
            {aba==="emitir"&&<AbaEmitirDocumento pac={pac} medico={medico} apiKey={apiKey} onDocSalvo={onDocSalvo} onDiagSalvo={onDiagSalvo} recarregarDiags={recarregarDiags} docsConsultaAtiva={docsConsulta} consultaEncerrada={false} agendamentoId={agendamentoConsulta?.id||null} agendamentoHora={agendamentoConsulta?.hora||null} agendamentoTipo={agendamentoConsulta?.tipo||null} onConteudoChange={setEmitirTemConteudo}/>}
            {aba==="diagnosticos"&&<AbaDiagnosticos diags={diags} pac={pac} medico={medico} onSalvo={onDiagSalvo}/>}
            {aba==="medicamentos"&&<AbaMedicamentos meds={meds} pac={pac} plano={planoPaciente}/>}
            {aba==="exames"&&<AbaExames exames={exames} pac={pac}/>}
            {aba==="estilo_vida"&&<AbaEstiloVida docs={estiloVidaDocs} pac={pac}/>}
            {aba==="episodios"&&<AbaEpisodiosMedico episodios={episodiosPaciente} pac={pac} medico={medico} onAtualizar={()=>carregarEpisodosPaciente(pac.id).then(setEpisodiosPaciente)}/>}
            {aba==="plano"&&<AbaPlanoMedico plano={planoPaciente} registros={registrosPlano} episodios={episodiosPaciente} pac={pac} medico={medico} onAtualizar={()=>carregarPlanoPaciente(pac.id).then(setPlanoPaciente)}/>}
            {aba==="desfechos"&&<AbaDesfechos pac={pac} medico={medico}/>}
            {aba==="mensagens"&&<AbaMensagensMedico pac={pac} medico={medico} apiKey={apiKey}/>}
          </>
        )}
      </div>

      {/* Barra inferior de consulta ativa */}
      {consultaAtiva&&(
        <div style={{flexShrink:0,borderTop:`1px solid ${T.green}30`,background:T.greenBg,padding:"12px 24px"}}>

          {/* Plano de cuidado — sempre visível durante consulta */}
          {planoPaciente.filter(t=>t.ativo!==false).length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:T.greenDark,fontWeight:600,letterSpacing:"0.08em",marginBottom:6}}>PLANO DE CUIDADO</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {/* Episódios primeiro — prioridade */}
                {episodiosPaciente.filter(pe=>pe.status==="ativo").map(pe=>{
                  const ep=pe.episodios;
                  if(!ep)return null;
                  const acoes=ep.episodio_acoes||[];
                  const diasPassados=Math.floor((new Date()-new Date(pe.data_inicio+"T12:00:00"))/(1000*60*60*24));
                  const proxima=acoes.filter(a=>(a.dia_inicio||0)>diasPassados).sort((a,b)=>(a.dia_inicio||0)-(b.dia_inicio||0))[0];
                  return(
                    <div key={pe.id} onClick={()=>setAba("episodios")}
                      style={{padding:"6px 12px",background:T.green,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13}}>🏥</span>
                      <div>
                        <div style={{fontSize:11,fontWeight:600,color:"#FFF"}}>{ep.nome}</div>
                        {proxima&&<div style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>Próx: {proxima.titulo}</div>}
                      </div>
                    </div>
                  );
                })}
                {/* Outras tarefas do plano */}
                {planoPaciente.filter(t=>t.ativo!==false).slice(0,4).map(t=>(
                  <div key={t.id} style={{padding:"6px 12px",background:T.surface,border:`1px solid ${T.greenBorder}`,borderRadius:8,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:12}}>{t.categoria==="medicamento"?"💊":t.categoria==="exame"?"🔬":t.categoria==="estilo_vida"?"🌿":"📋"}</span>
                    <div style={{fontSize:11,color:T.inkMid,maxWidth:140,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.titulo}</div>
                  </div>
                ))}
                {planoPaciente.filter(t=>t.ativo!==false).length>4&&(
                  <div style={{padding:"6px 12px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,color:T.inkFaint,cursor:"pointer"}}
                    onClick={()=>setAba("plano")}>
                    +{planoPaciente.filter(t=>t.ativo!==false).length-4} mais
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Episódios ativos — banner detalhado se existir */}
          {episodiosPaciente.filter(pe=>pe.status==="ativo").length===0&&planoPaciente.length===0&&(
            <div style={{fontSize:11,color:T.inkMid,marginBottom:8,fontStyle:"italic"}}>Nenhum plano de cuidado ativo</div>
          )}

          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:T.greenDark}}>
                Consulta em andamento
                {agendamentoConsulta&&<span style={{fontWeight:400,color:T.inkMid}}> · {agendamentoConsulta.hora?.slice(0,5)} {agendamentoConsulta.tipo}</span>}
              </div>
              <div style={{fontSize:11,color:T.inkMid}}>
                {docsConsulta.length>0?`${docsConsulta.length} documento${docsConsulta.length!==1?"s":""} emitido${docsConsulta.length!==1?"s":""} · ${docsConsulta.map(d=>d.titulo||d.tipo).join(", ")}`:"Nenhum documento emitido ainda"}
              </div>
            </div>
            <button onClick={()=>{setAba("emitir");setTimeout(()=>{if(scrollContainerRef.current)scrollContainerRef.current.scrollTop=0;},100);}}
              style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${T.green}`,background:T.surface,color:T.green,fontSize:12,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
              + Emitir outro documento
            </button>
            <button onClick={()=>gerarSugestoesPlaroEEncerrar()}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:T.green,color:"#FFF",fontSize:12,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
              Encerrar consulta →
            </button>
          </div>
        </div>
      )}

      {/* Modal plano de cuidado */}
      {modalPlano&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:580,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:4}}>Plano de cuidado</div>
            <div style={{fontSize:13,color:T.inkMid,marginBottom:20,lineHeight:1.6}}>
              Baseado nos documentos desta consulta, identifiquei as tarefas abaixo para o plano de cuidado de {pac.nome.split(" ")[0]}. Selecione as que deseja incluir e ajuste a frequência se necessário.
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {sugestoesPlano.map((s,i)=>(
                <div key={i} style={{padding:"14px 16px",borderRadius:10,border:`1px solid ${s.incluir?T.greenBorder:T.border}`,background:s.incluir?T.greenBg:T.surface,transition:"all 0.15s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <input type="checkbox" checked={s.incluir}
                      onChange={e=>setSugestoesPlano(prev=>prev.map((x,j)=>j===i?{...x,incluir:e.target.checked}:x))}
                      style={{width:16,height:16,accentColor:T.green,marginTop:2,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:18}}>{s.icon}</span>
                        <input value={s.titulo}
                          onChange={e=>setSugestoesPlano(prev=>prev.map((x,j)=>j===i?{...x,titulo:e.target.value}:x))}
                          style={{flex:1,fontSize:13,fontWeight:500,color:T.ink,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",fontFamily:T.f,background:T.surface}}/>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <select value={s.frequencia_tipo}
                          onChange={e=>setSugestoesPlano(prev=>prev.map((x,j)=>j===i?{...x,frequencia_tipo:e.target.value}:x))}
                          style={{fontSize:11,padding:"3px 8px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,color:T.inkMid,background:T.surface}}>
                          <option value="diario">Diário</option>
                          <option value="n_vezes_semana">N vezes/semana</option>
                          <option value="uma_vez_semana">1x por semana</option>
                          <option value="uma_vez_mes">1x por mês</option>
                          <option value="unico">Único</option>
                        </select>
                        {s.frequencia_tipo==="n_vezes_semana"&&(
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <input type="number" min={1} max={7} value={s.meta_semanal||3}
                              onChange={e=>setSugestoesPlano(prev=>prev.map((x,j)=>j===i?{...x,meta_semanal:Number(e.target.value)}:x))}
                              style={{width:40,fontSize:11,padding:"3px 6px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,textAlign:"center"}}/>
                            <span style={{fontSize:11,color:T.inkMid}}>x/sem</span>
                          </div>
                        )}
                        <Badge label={s.categoria} color={T.blue} bg={T.blueBg}/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:T.inkMid,marginBottom:16}}>
              {sugestoesPlano.filter(s=>s.incluir).length} de {sugestoesPlano.length} tarefas selecionadas para o plano
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setModalPlano(false);setConfirmarEncerrar(true);}}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Pular — encerrar sem plano
              </button>
              <button onClick={handleSalvarPlanoEEncerrar} disabled={salvandoPlano}
                style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:T.green,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500,opacity:salvandoPlano?0.6:1}}>
                {salvandoPlano?"Salvando...":"✓ Salvar plano e encerrar consulta →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aviso sair sem salvar */}
      {avisarSairEmitir&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:420,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:8}}>⚠️ Dados não salvos</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.7,marginBottom:20}}>
              Você tem campos preenchidos que ainda não foram salvos no prontuário. Se sair agora, perderá o que foi registrado.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setAvisarSairEmitir(null)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Voltar e salvar
              </button>
              <button onClick={()=>{setAba(avisarSairEmitir);setAvisarSairEmitir(null);setEmitirTemConteudo(false);}}
                style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:T.orange,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar encerramento */}
      {confirmarEncerrar&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:420,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:8}}>Encerrar consulta?</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.7,marginBottom:20}}>
              Todos os {docsConsulta.length} documento{docsConsulta.length!==1?"s":""} já foram salvos no prontuário de {pac.nome.split(" ")[0]}. Tem certeza que deseja encerrar a consulta agora?
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmarEncerrar(false)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Cancelar
              </button>
              <button onClick={encerrarConsulta}
                style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:T.green,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
                Sim, encerrar consulta
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Aba Check-ins ────────────────────────────────────────────────
function AbaCheckins({checkins,pac}){
  if(checkins.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
      <div style={{fontSize:32,marginBottom:12}}>📊</div>
      <div>Nenhum check-in registrado ainda</div>
    </div>
  );

  const EIXOS=[
    {key:"energia",label:"Energia",cor:T.green},
    {key:"sono",label:"Sono",cor:T.blue},
    {key:"estresse",label:"Estresse",cor:T.red},
    {key:"humor",label:"Humor",cor:T.orange},
    {key:"vinculos",label:"Vínculos",cor:T.purple},
    {key:"bem_estar",label:"Bem-estar",cor:T.green},
  ];

  return(
    <div style={{maxWidth:900}}>

      {/* Mini gráfico dos últimos 14 dias */}
      <Card style={{padding:"18px 20px",marginBottom:16}}>
        <Lbl>Tendência — últimos {Math.min(checkins.length,14)} dias</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginTop:8}}>
          {EIXOS.map(e=>{
            const vals=checkins.slice(0,14).reverse().map(c=>c[e.key]||0);
            const media=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
            return(
              <div key={e.key} style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:T.inkMid,marginBottom:6}}>{e.label}</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:2,height:32,justifyContent:"center"}}>
                  {vals.slice(-7).map((v,i)=>(
                    <div key={i} style={{width:6,height:`${Math.max(2,v*3.2)}px`,borderRadius:2,background:e.cor,opacity:0.6+i*0.05}}/>
                  ))}
                </div>
                <div style={{fontSize:14,fontWeight:700,color:e.cor,marginTop:4}}>{media}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Lista de check-ins */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {checkins.map(ci=>(
          <Card key={ci.id} style={{padding:"14px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:500,color:T.ink}}>
                {new Date(ci.data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
              </div>
              {ci.data===dataHoje()&&<Badge label="Hoje" color={T.green} bg={T.greenBg}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:ci.sintomas||ci.notas?10:0}}>
              {EIXOS.map(e=>(
                <div key={e.key} style={{textAlign:"center",padding:"8px",background:T.bgWarm,borderRadius:8}}>
                  <div style={{fontSize:9,color:T.inkFaint,marginBottom:2}}>{e.label}</div>
                  <div style={{fontSize:16,fontWeight:700,color:e.cor}}>{ci[e.key]||"—"}</div>
                </div>
              ))}
            </div>
            {ci.sintomas&&<div style={{fontSize:12,color:T.inkMid,marginBottom:4}}>Sintomas: {ci.sintomas}</div>}
            {ci.notas&&<div style={{fontSize:12,color:T.inkMid}}>Observações: {ci.notas}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function AbaMensagensMedico({pac,medico,apiKey}){
  const[msgs,setMsgs]=useState([]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(true);
  const[enviando,setEnviando]=useState(false);
  const bottomRef=useRef(null);

  useEffect(()=>{
    supabase.from("mensagens")
      .select("*")
      .eq("paciente_id",pac.id)
      .order("created_at")
      .then(({data})=>setMsgs(data||[]))
      .finally(()=>setLoading(false));
  },[pac.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const enviar=async()=>{
    if(!input.trim())return;
    setEnviando(true);
    const msg={paciente_id:pac.id,medico_id:medico.id,conteudo:input.trim(),remetente:"medico"};
    const{data}=await supabase.from("mensagens").insert(msg).select("*").single();
    if(data)setMsgs(prev=>[...prev,data]);
    setInput("");setEnviando(false);
  };

  if(loading)return<div style={{textAlign:"center",paddingTop:40}}><Spinner/></div>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",maxWidth:800}}>
      {msgs.length===0&&(
        <div style={{textAlign:"center",padding:"32px",color:T.inkFaint,fontSize:13}}>
          <div style={{fontSize:28,marginBottom:8}}>💬</div>
          Nenhuma mensagem ainda. Inicie a conversa com {pac.nome.split(" ")[0]}.
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",paddingBottom:12}}>
        {msgs.map(m=>{
          const isMedico=m.remetente==="medico";
          return(
            <div key={m.id} style={{display:"flex",flexDirection:isMedico?"row-reverse":"row",gap:8,marginBottom:12,alignItems:"flex-end"}}>
              {!isMedico&&<Avatar nome={pac.nome} size={28}/>}
              <div style={{maxWidth:"72%",padding:"10px 14px",
                background:isMedico?T.greenBg:T.surface,
                border:`0.5px solid ${isMedico?T.greenBorder:T.border}`,
                borderRadius:isMedico?"12px 12px 4px 12px":"4px 12px 12px 12px",
                fontSize:13,color:T.ink,lineHeight:1.6}}>
                {m.conteudo}
                <div style={{fontSize:10,color:T.inkFaint,marginTop:4,textAlign:isMedico?"right":"left"}}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}}
          placeholder={`Mensagem para ${pac.nome.split(" ")[0]}...`}
          style={{flex:1,padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,
            fontFamily:T.f,fontSize:13,outline:"none",color:T.ink}}/>
        <Btn onClick={enviar} disabled={enviando||!input.trim()}>Enviar</Btn>
      </div>
    </div>
  );
}

// ─── DocCard ─────────────────────────────────────────────────────
function DocCard({doc,c,cor,aberto,onToggle,TIPO_ICON}){
  return(
    <Card style={{padding:"0",overflow:"hidden",cursor:"pointer",borderLeft:`3px solid ${cor}`}} onClick={onToggle}>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:7,background:`${cor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          {TIPO_ICON[doc.tipo]||"📄"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{doc.titulo}</div>
          {!aberto&&doc.resumo&&<div style={{fontSize:11,color:T.inkMid}}>{doc.resumo.slice(0,60)}{doc.resumo.length>60?"...":""}</div>}
        </div>
        <span style={{fontSize:11,color:T.inkFaint}}>{aberto?"▲":"▼"}</span>
      </div>
      {aberto&&(
        <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 16px",background:T.bgWarm}}>
          {c.motivo&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:3}}>MOTIVO</div><div style={{fontSize:13,color:T.ink,lineHeight:1.7}}>{c.motivo}</div></div>}
          {c.conduta&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:3}}>{doc.tipo==="receita"?"MEDICAMENTOS":doc.tipo==="pedido_exame"?"EXAMES":"CONDUTA"}</div><div style={{fontSize:13,color:T.ink,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{c.conduta}</div></div>}
          {c.medicamentos?.length>0&&<div style={{marginBottom:10}}>{c.medicamentos.map((m,i)=><div key={i} style={{fontSize:12,color:T.ink,marginBottom:4}}>• {m.nome} {m.dose} — {m.posologia}{m.duracao?" ("+m.duracao+")":""}</div>)}</div>}
          {c.exames?.length>0&&<div style={{marginBottom:10}}>{c.exames.map((e,i)=><div key={i} style={{fontSize:12,color:T.ink,marginBottom:4}}>• {e.nome}{e.indicacao?" — "+e.indicacao:""}</div>)}</div>}
          {c.orientacoes&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:3}}>ORIENTAÇÕES</div><div style={{fontSize:13,color:T.ink,lineHeight:1.7}}>{c.orientacoes}</div></div>}
          {c.retorno&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:3}}>{doc.tipo==="atestado"?"AFASTAMENTO":"RETORNO"}</div><div style={{fontSize:13,color:T.ink}}>{c.retorno}</div></div>}
          {(c.cid||c.nomeDiag)&&<div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,paddingTop:8,borderTop:`0.5px solid ${T.border}`}}><span style={{fontSize:10,color:T.inkFaint}}>CID:</span>{c.cid&&<Badge label={c.cid} color={cor}/>}{c.nomeDiag&&<span style={{fontSize:12,color:T.inkMid}}>{c.nomeDiag}</span>}</div>}
          {!c.motivo&&!c.conduta&&doc.resumo&&<div style={{fontSize:13,color:T.ink,lineHeight:1.7}}>{doc.resumo}</div>}
        </div>
      )}
    </Card>
  );
}

// ─── Aba Histórico ───────────────────────────────────────────────
function AbaHistorico({agendamentos,docs,medico}){
  const[subAba,setSubAba]=useState("consultas");
  const[filtroTipo,setFiltroTipo]=useState("todos");
  const[expandidoAg,setExpandidoAg]=useState(null); // id do agendamento expandido
  const[expandidoDoc,setExpandidoDoc]=useState(null); // id do doc expandido

  const TIPO_ICON={consulta:"📋",receita:"💊",atestado:"📄",pedido_exame:"🔬",relatorio:"📑",encaminhamento:"↗️"};
  const TIPO_LABEL={consulta:"Consulta clínica",receita:"Prescrição",atestado:"Atestado",pedido_exame:"Pedido de exames",relatorio:"Relatório",encaminhamento:"Encaminhamento"};
  const TIPO_COR={consulta:T.blue,receita:T.green,atestado:T.orange,pedido_exame:T.purple,relatorio:T.ink,encaminhamento:T.blue};
  const STATUS_COR={realizada:T.green,agendado:T.blue,cancelado:T.red,"não compareceu":T.orange,remarcacao_pendente:T.orange};

  const consultas=agendamentos.filter(a=>filtroTipo==="todos"||a.tipo===filtroTipo)
    .sort((a,b)=>{
      if(b.data!==a.data)return b.data>a.data?1:-1;
      return (b.hora||"")>(a.hora||"")?1:-1; // mesmo dia — ordenar por hora
    });

  const porMes={};
  consultas.forEach(a=>{
    const d=new Date(a.data+"T12:00:00");
    const chave=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label=d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
    if(!porMes[chave])porMes[chave]={label,items:[]};
    porMes[chave].items.push(a);
  });

  const docsFiltrados=docs.filter(d=>filtroTipo==="todos"||d.tipo===filtroTipo);
  const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  return(
    <div style={{maxWidth:900}}>

      {/* Sub-abas */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`0.5px solid ${T.border}`}}>
        {[{id:"consultas",label:"Consultas"},{id:"documentos",label:"Documentos emitidos"}].map(s=>(
          <button key={s.id} onClick={()=>setSubAba(s.id)}
            style={{padding:"8px 18px",background:"none",border:"none",
              borderBottom:`2px solid ${subAba===s.id?T.green:"transparent"}`,
              cursor:"pointer",fontFamily:T.f,fontSize:13,
              color:subAba===s.id?T.green:T.inkMid,fontWeight:subAba===s.id?500:400}}>
            {s.label}
          </button>
        ))}
      </div>

      {subAba==="consultas"&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
            <span style={{fontSize:12,color:T.inkMid}}>Filtrar:</span>
            {["todos","teleconsulta","presencial"].map(f=>(
              <button key={f} onClick={()=>setFiltroTipo(f)}
                style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filtroTipo===f?T.green:T.border}`,
                  background:filtroTipo===f?T.greenBg:T.surface,color:filtroTipo===f?T.green:T.inkMid,
                  fontSize:12,cursor:"pointer",fontFamily:T.f}}>
                {f==="todos"?"Todos":f==="teleconsulta"?"📹 Teleconsulta":"🏥 Presencial"}
              </button>
            ))}
            <span style={{marginLeft:"auto",fontSize:12,color:T.inkFaint}}>{consultas.length} registros</span>
          </div>

          {consultas.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
              <div style={{fontSize:32,marginBottom:12}}>📋</div>
              <div>Nenhuma consulta registrada</div>
            </div>
          )}

          {Object.entries(porMes).sort((a,b)=>b[0]>a[0]?1:-1).map(([chave,{label,items}])=>(
            <div key={chave} style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>
                {label}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {items.map(ag=>{
                  const d=new Date(ag.data+"T12:00:00");
                  const dia=d.getDate();
                  const diaSem=DIAS[d.getDay()];
                  const statusCor=STATUS_COR[ag.status]||T.inkMid;
                  const docsConsulta=docs.filter(doc=>doc.agendamento_id===ag.id);
                  const expandido=expandidoAg===ag.id;
                  const rawag=ag.conteudo_json||{};
                  const conteudo=typeof rawag==="string"?JSON.parse(rawag):rawag;

                  return(
                    <Card key={ag.id} style={{padding:"0",overflow:"hidden",cursor:"pointer"}}
                      onClick={()=>setExpandidoAg(expandido?null:ag.id)}>
                      {/* Header da consulta — sempre visível */}
                      <div style={{padding:"14px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
                        <div style={{width:42,textAlign:"center",flexShrink:0}}>
                          <div style={{fontSize:20,fontWeight:600,color:T.ink,lineHeight:1}}>{dia}</div>
                          <div style={{fontSize:10,color:T.inkFaint}}>{diaSem.toLowerCase()}</div>
                        </div>
                        <div style={{width:1,background:T.border,alignSelf:"stretch",flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:2}}>
                                {ag.tipo==="teleconsulta"?"📹":"🏥"} {ag.tipo==="teleconsulta"?"Teleconsulta":"Consulta presencial"}
                                {ag.hora&&<span style={{fontSize:12,color:T.inkMid,fontWeight:400}}> · {ag.hora.slice(0,5)}</span>}
                                {ag.duracao&&<span style={{fontSize:12,color:T.inkMid,fontWeight:400}}> · {ag.duracao}min</span>}
                              </div>
                              <div style={{fontSize:12,color:T.inkMid}}>{medico.nome}</div>
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <Badge label={ag.status||"agendado"} color={statusCor}/>
                              {docsConsulta.length>0&&(
                                <Badge label={`${docsConsulta.length} doc${docsConsulta.length>1?"s":""}`} color={T.blue} bg={T.blueBg}/>
                              )}
                              <span style={{fontSize:12,color:T.inkFaint}}>{expandido?"▲":"▼"}</span>
                            </div>
                          </div>
                          {/* Resumo curto quando fechado */}
                          {!expandido&&ag.resumo&&(
                            <div style={{fontSize:12,color:T.inkMid,marginTop:4}}>{ag.resumo.slice(0,80)}{ag.resumo.length>80?"...":""}</div>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo expandido — mostra documentos vinculados */}
                      {expandido&&(
                        <div style={{borderTop:`0.5px solid ${T.border}`,padding:"16px 18px",paddingLeft:74}}>
                          {docsConsulta.length===0?(
                            <div style={{fontSize:12,color:T.inkFaint,fontStyle:"italic"}}>
                              Nenhum documento emitido nesta consulta
                            </div>
                          ):(
                            <div style={{display:"flex",flexDirection:"column",gap:10}}>
                              <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:2}}>DOCUMENTOS DA CONSULTA</div>
                              {docsConsulta.map(doc=>{
                                const cor=TIPO_COR[doc.tipo]||T.ink;
                                const rawc=doc.conteudo_json||{};
                                const c=typeof rawc==="string"?(() => { try { return JSON.parse(rawc); } catch(e) { return {}; } })():rawc;
                                const aberto=expandidoDoc===doc.id;
                                return(
                                  <DocCard key={doc.id} doc={doc} c={c} cor={cor} aberto={aberto}
                                    onToggle={e=>{if(e&&e.stopPropagation)e.stopPropagation();setExpandidoDoc(aberto?null:doc.id);}}
                                    TIPO_ICON={TIPO_ICON}/>
                                );
                              })}
                            </div>
                          )}
                          {ag.resumo&&(
                            <div style={{marginTop:10,fontSize:12,color:T.inkMid,fontStyle:"italic"}}>
                              {ag.resumo}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {subAba==="documentos"&&(
        <>
          {docs.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
              <div style={{fontSize:32,marginBottom:12}}>📄</div>
              <div>Nenhum documento emitido</div>
            </div>
          )}

          {/* Docs de consultas — agrupados por consulta */}
          {agendamentos.filter(ag=>docs.some(d=>d.agendamento_id===ag.id)).length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Emitidos em consultas</div>
              {agendamentos.filter(ag=>docs.some(d=>d.agendamento_id===ag.id)).sort((a,b)=>b.data>a.data?1:-1).map(ag=>{
                const d=new Date(ag.data+"T12:00:00");
                const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                const docsAg=docs.filter(doc=>doc.agendamento_id===ag.id);
                return(
                  <div key={ag.id} style={{marginBottom:16,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                    {/* Cabeçalho da consulta */}
                    <div style={{padding:"12px 18px",background:T.greenBg,borderBottom:`0.5px solid ${T.greenBorder}`,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>{ag.tipo==="teleconsulta"?"📹":"🏥"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:T.greenDark}}>
                          {DIAS[d.getDay()]}, {d.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"})}
                          {ag.hora&&<span style={{fontWeight:400}}> · {ag.hora.slice(0,5)}</span>}
                        </div>
                        <div style={{fontSize:11,color:T.inkMid,textTransform:"capitalize"}}>{ag.tipo}{ag.duracao&&` · ${ag.duracao}min`}</div>
                      </div>
                      <Badge label={`${docsAg.length} documento${docsAg.length>1?"s":""}`} color={T.green} bg="white"/>
                    </div>
                    {/* Documentos da consulta */}
                    <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8,background:T.surface}}>
                      {docsAg.map(doc=>{
                        const cor=TIPO_COR[doc.tipo]||T.ink;
                        const aberto=expandidoDoc===doc.id;
                        const rawc=doc.conteudo_json||{};
                        const c=typeof rawc==="string"?JSON.parse(rawc):rawc;
                        return <DocCard key={doc.id} doc={doc} c={c} cor={cor} aberto={aberto} onToggle={()=>setExpandidoDoc(aberto?null:doc.id)} TIPO_ICON={TIPO_ICON}/>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Docs avulsos — sem agendamento_id */}
          {docs.filter(d=>!d.agendamento_id).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Documentos avulsos</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {docs.filter(d=>!d.agendamento_id).map(doc=>{
                  const cor=TIPO_COR[doc.tipo]||T.ink;
                  const aberto=expandidoDoc===doc.id;
                  const rawc=doc.conteudo_json||{};
                  const c=typeof rawc==="string"?JSON.parse(rawc):rawc;
                  return <DocCard key={doc.id} doc={doc} c={c} cor={cor} aberto={aberto} onToggle={()=>setExpandidoDoc(aberto?null:doc.id)} TIPO_ICON={TIPO_ICON}/>;
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Exame Buscador (TUSS) ───────────────────────────────────────
function ExameBuscador({exames,setExames,conduta,setConduta,apiKey}){
  const[textoLivre,setTextoLivre]=useState("");
  const[buscando,setBuscando]=useState(false);
  const[sugestoes,setSugestoes]=useState([]);
  const[mostrarModal,setMostrarModal]=useState(false);
  const timerRef=useRef(null);

  const buscar=async(txt)=>{
    if(!txt||txt.trim().length<3)return;
    const ch=apiKey||localStorage.getItem("hvv_med_api_key")||"";
    if(!ch.startsWith("sk-"))return;
    setBuscando(true);
    try{
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ch,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          messages:[{role:"user",content:"Voce e especialista em codigos TUSS. O medico escreveu em linguagem coloquial os seguintes exames: "+txt+". Identifique CADA exame separadamente e retorne um array JSON. Cada item deve ter: tuss (codigo TUSS), nome (nome tecnico oficial), indicacao (indicacao clinica inferida), coloquial (como o medico escreveu). Retorne SOMENTE o array JSON sem markdown."}]
        })
      });
      const data=await res.json();
      const raw=(data.content?.[0]?.text||"[]").trim();
      const match=raw.match(/\[[\s\S]*\]/);
      if(match){
        const parsed=JSON.parse(match[0]);
        setSugestoes(parsed);
        setMostrarModal(true);
      }
    }catch(e){console.warn(e);}
    finally{setBuscando(false);}
  };

  const handleTexto=(val)=>{
    setTextoLivre(val);
    clearTimeout(timerRef.current);
    if(val.trim().length>=5){
      timerRef.current=setTimeout(()=>buscar(val),1200);
    }
  };

  const adicionarExame=(s)=>{
    setExames(prev=>[...prev,{nome:s.nome,tuss:s.tuss,indicacao:s.indicacao||""}]);
  };

  const adicionarTodos=()=>{
    setExames(prev=>[...prev,...sugestoes.map(s=>({nome:s.nome,tuss:s.tuss,indicacao:s.indicacao||""}))]);
    setMostrarModal(false);
    setTextoLivre("");
    setSugestoes([]);
  };

  return(
    <div>
      <Lbl>Exames solicitados (escreva livremente — a IA identifica e busca o código TUSS)</Lbl>

      {/* Campo de texto livre */}
      <div style={{position:"relative",marginBottom:8}}>
        <textarea value={textoLivre} onChange={e=>handleTexto(e.target.value)}
          placeholder="Ex: hemograma completo, glicemia em jejum, TSH e colesterol total..."
          rows={3}
          style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,
            fontFamily:T.f,fontSize:13,color:T.ink,outline:"none",resize:"vertical",
            lineHeight:1.6,boxSizing:"border-box",background:T.surface}}/>
        {buscando&&(
          <div style={{position:"absolute",right:12,top:12,
            width:14,height:14,border:`2px solid ${T.blue}30`,borderTop:`2px solid ${T.blue}`,
            borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        )}
      </div>
      {!buscando&&textoLivre.trim().length>=5&&(
        <button onClick={()=>buscar(textoLivre)}
          style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:`1px solid ${T.green}`,
            background:T.greenBg,color:T.green,cursor:"pointer",fontFamily:T.f,marginBottom:12}}>
          ✦ Identificar exames e buscar TUSS
        </button>
      )}

      {/* Exames já adicionados */}
      {exames.length>0&&(
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:6}}>EXAMES ADICIONADOS</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {exames.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.bgWarm,borderRadius:8}}>
                {e.tuss&&<Badge label={e.tuss} color={T.purple} bg={T.purpleBg}/>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{e.nome}</div>
                  {e.indicacao&&<div style={{fontSize:11,color:T.inkMid}}>{e.indicacao}</div>}
                </div>
                <button onClick={()=>setExames(prev=>prev.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:16}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de sugestões TUSS */}
      {mostrarModal&&sugestoes.length>0&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:560,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontSize:16,fontWeight:500,color:T.ink,marginBottom:4}}>Exames identificados</div>
            <div style={{fontSize:12,color:T.inkMid,marginBottom:16}}>
              A IA identificou <strong>{sugestoes.length} exame{sugestoes.length>1?"s":""}</strong>. Confirme os que deseja solicitar:
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {sugestoes.map((s,i)=>{
                const jaAdicionado=exames.some(e=>e.tuss===s.tuss||e.nome===s.nome);
                return(
                  <div key={i} style={{padding:"12px 14px",borderRadius:8,border:`1px solid ${jaAdicionado?T.greenBorder:T.border}`,
                    background:jaAdicionado?T.greenBg:T.surface,display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        {s.tuss&&<Badge label={s.tuss} color={T.purple} bg={T.purpleBg}/>}
                        <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{s.nome}</div>
                      </div>
                      {s.coloquial&&s.coloquial!==s.nome&&(
                        <div style={{fontSize:11,color:T.inkFaint}}>Como escrito: {s.coloquial}</div>
                      )}
                      {s.indicacao&&<div style={{fontSize:11,color:T.inkMid,marginTop:2}}>{s.indicacao}</div>}
                    </div>
                    {jaAdicionado?(
                      <span style={{fontSize:11,color:T.green,flexShrink:0}}>✓ Adicionado</span>
                    ):(
                      <button onClick={()=>adicionarExame(s)}
                        style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${T.green}`,
                          background:T.greenBg,color:T.green,fontSize:12,cursor:"pointer",fontFamily:T.f,flexShrink:0}}>
                        Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setMostrarModal(false)}
                style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Fechar
              </button>
              <button onClick={adicionarTodos}
                style={{flex:2,padding:"9px",borderRadius:8,border:"none",
                  background:T.green,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
                Adicionar todos →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CID Buscador ────────────────────────────────────────────────
function CidBuscador({cid,nomeDiag,onSelect,apiKey}){
  const[texto,setTexto]=useState(cid?nomeDiag:"");
  const[buscando,setBuscando]=useState(false);
  const[sugestoes,setSugestoes]=useState([]);
  const[mostrarModal,setMostrarModal]=useState(false);
  const timerRef=useRef(null);

  // Se já tem CID selecionado, mostrar resumido
  if(cid&&!mostrarModal){
    return(
      <div style={{marginBottom:12}}>
        <Lbl>Diagnóstico / CID</Lbl>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:8}}>
          <Badge label={cid} color={T.green} bg={T.greenBg}/>
          <span style={{fontSize:13,color:T.ink,flex:1}}>{nomeDiag}</span>
          <button onClick={()=>{onSelect("","");setTexto("");setSugestoes([]);}}
            style={{background:"none",border:"none",color:T.inkFaint,cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
        </div>
      </div>
    );
  }

  const buscar=async(txt)=>{
    if(!txt||txt.trim().length<3)return;
    const ch=apiKey||localStorage.getItem("hvv_med_api_key")||"";
    if(!ch.startsWith("sk-"))return;
    setBuscando(true);
    try{
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ch,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:400,
          messages:[{role:"user",content:"Medico descreveu em linguagem coloquial: "+txt+". Sugira os 3-5 CIDs mais provaveis. Retorne SOMENTE array JSON sem markdown. Confianca pode ser alta, media ou baixa. Exemplo de formato esperado: cid, nome, confianca."}]
        })
      });
      const data=await res.json();
      const raw=(data.content?.[0]?.text||"[]").trim();
      const match=raw.match(/\[[\s\S]*\]/);
      if(match)setSugestoes(JSON.parse(match[0]));
      setMostrarModal(true);
    }catch(e){console.warn(e);}
    finally{setBuscando(false);}
  };

  const handleTexto=(val)=>{
    setTexto(val);
    setSugestoes([]);
    clearTimeout(timerRef.current);
    if(val.trim().length>=3){
      timerRef.current=setTimeout(()=>buscar(val),1000);
    }
  };

  return(
    <div style={{marginBottom:12}}>
      <Lbl>Diagnóstico (escreva como preferir — a IA sugere o CID)</Lbl>
      <div style={{position:"relative"}}>
        <input value={texto} onChange={e=>handleTexto(e.target.value)}
          placeholder="Ex: pressão alta, diabetes, ansiedade..."
          style={{width:"100%",padding:"10px 40px 10px 12px",border:`1px solid ${T.border}`,borderRadius:8,
            fontFamily:T.f,fontSize:13,color:T.ink,outline:"none",boxSizing:"border-box",background:T.surface}}/>
        {buscando&&(
          <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
            width:14,height:14,border:`2px solid ${T.blue}30`,borderTop:`2px solid ${T.blue}`,
            borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        )}
        {!buscando&&texto.length>=3&&(
          <button onClick={()=>buscar(texto)}
            style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
              background:T.green,border:"none",borderRadius:6,padding:"3px 8px",
              color:"#FFF",fontSize:11,cursor:"pointer",fontFamily:T.f}}>
            Buscar CID
          </button>
        )}
      </div>
      <div style={{fontSize:11,color:T.inkFaint,marginTop:4}}>
        Aguarde 1 segundo após digitar ou clique em Buscar CID
      </div>

      {/* Modal de sugestões */}
      {mostrarModal&&sugestoes.length>0&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:500,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:16,fontWeight:500,color:T.ink,marginBottom:4}}>Selecione o CID</div>
            <div style={{fontSize:12,color:T.inkMid,marginBottom:16}}>
              Baseado em <strong>{texto}</strong> — escolha o diagnóstico mais preciso:
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {sugestoes.map((s,i)=>(
                <button key={i} onClick={()=>{onSelect(s.cid,s.nome);setTexto(s.nome);setMostrarModal(false);setSugestoes([]);}}
                  style={{padding:"12px 16px",borderRadius:8,border:`1px solid ${T.border}`,
                    background:T.surface,cursor:"pointer",textAlign:"left",fontFamily:T.f,
                    display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.background=T.greenBg;}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}>
                  <Badge label={s.cid} color={T.green} bg={T.greenBg}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{s.nome}</div>
                  </div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,
                    background:s.confianca==="alta"?T.greenBg:s.confianca==="media"?T.orangeBg:T.bgWarm,
                    color:s.confianca==="alta"?T.green:s.confianca==="media"?T.orange:T.inkFaint}}>
                    {s.confianca==="alta"?"Alta confiança":s.confianca==="media"?"Média confiança":"Baixa confiança"}
                  </span>
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setMostrarModal(false)}
                style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Cancelar
              </button>
              <button onClick={()=>{
                  // Usar sem CID — só o texto
                  onSelect("",texto);
                  setMostrarModal(false);
                }}
                style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Usar sem CID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba Consulta ─────────────────────────────────────────────────
function AbaEmitirDocumento({pac,medico,apiKey,onDocSalvo,onDiagSalvo,recarregarDiags,docsConsultaAtiva=[],consultaEncerrada=false,agendamentoId=null,agendamentoHora=null,agendamentoTipo=null,onConteudoChange}){
  const[tipo,setTipo]=useState("consulta");
  const[textoLivre,setTextoLivre]=useState("");
  const[motivo,setMotivo]=useState("");
  const[conduta,setConduta]=useState("");
  const[orientacoes,setOrientacoes]=useState("");
  const[retorno,setRetorno]=useState("");
  const[cid,setCid]=useState("");
  const[nomeDiag,setNomeDiag]=useState("");
  const[dataConsulta,setDataConsulta]=useState(dataHoje());
  const[hora,setHora]=useState(agendamentoHora?agendamentoHora.slice(0,5):"09:00");
  const[tipoConsulta,setTipoConsulta]=useState(agendamentoTipo||"teleconsulta");
  const[agendarRetorno,setAgendarRetorno]=useState(false);
  const[dataRetorno,setDataRetorno]=useState("");
  const[horaRetorno,setHoraRetorno]=useState("09:00");
  // estruturados pela IA
  const[medicamentos,setMedicamentos]=useState([]); // [{nome,dose,posologia,duracao}]
  const[exames,setExames]=useState([]); // [{nome,indicacao}]
  const[estiloVida,setEstiloVida]=useState([]); // [{categoria,orientacao}]
  // estados de UI
  const[salvando,setSalvando]=useState(false);
  const[salvo,setSalvo]=useState(false);
  const[processando,setProcessando]=useState(false);
  const[diagsExtraidos,setDiagsExtraidos]=useState([]);
  const[modoTextoLivre,setModoTextoLivre]=useState(false);
  const[modalDuplicata,setModalDuplicata]=useState(null);
  const[modalSairSemSalvar,setModalSairSemSalvar]=useState(null); // callback a executar após confirmar
  const tiposEmitidos=docsConsultaAtiva.map(d=>d.tipo);
  const topoCards=useRef(null);
  const formularioRef=useRef(null);

  // Detectar se há conteúdo não salvo
  const temConteudo=!!(motivo||conduta||orientacoes||retorno||textoLivre||medicamentos.length||exames.length||estiloVida.length);
  useEffect(()=>{if(onConteudoChange)onConteudoChange(temConteudo);},[temConteudo]);

  const trocarTipoComVerificacao=(novoTipo,callback)=>{
    if(temConteudo&&novoTipo!==tipo){
      setModalSairSemSalvar(()=>callback);
    } else {
      callback();
    }
  };

  const TIPOS=[
    {id:"consulta",label:"Consulta clínica",icon:"📋",desc:"Registro clínico com motivo, conduta e orientações"},
    {id:"receita",label:"Receita / Prescrição",icon:"💊",desc:"Medicamentos com dose e posologia"},
    {id:"atestado",label:"Atestado médico",icon:"📄",desc:"Afastamento com período e justificativa"},
    {id:"pedido_exame",label:"Pedido de exames",icon:"🔬",desc:"Solicitação de exames laboratoriais ou de imagem"},
    {id:"estilo_vida",label:"Prescrição de estilo de vida",icon:"🌿",desc:"Alimentação, atividade física, sono e bem-estar"},
    {id:"relatorio",label:"Relatório / Encaminhamento",icon:"📑",desc:"Relatório clínico ou encaminhamento para especialista"},
  ];

  const chave=()=>apiKey||localStorage.getItem("hvv_med_api_key")||"";

  // ── Processar texto livre com IA ──────────────────────────────────
  const processarComIA=async()=>{
    const ch=chave();
    if(!ch.startsWith("sk-")||!textoLivre.trim())return;
    setProcessando(true);

    const prompts={
      receita:'Voce e farmaceutico clinico. Leia o texto e extraia TODOS os medicamentos. Retorne SOMENTE array JSON: [{"nome":"Losartana","dose":"50mg","posologia":"1x ao dia","duracao":"uso continuo"}]. Texto: ',
      pedido_exame:'Voce e medico. Leia o texto e extraia TODOS os exames solicitados. Retorne SOMENTE array JSON: [{"nome":"Hemograma completo","indicacao":"controle de anemia"}]. Texto: ',
      estilo_vida:'Voce e medico especialista em medicina do estilo de vida. Leia o texto e extraia TODAS as orientacoes de estilo de vida por categoria. Retorne SOMENTE array JSON: [{"categoria":"Alimentacao","orientacao":"Reduzir sodio para menos de 2g ao dia"},{"categoria":"Atividade fisica","orientacao":"Caminhada 30min 5x por semana"}]. Categorias possiveis: Alimentacao, Atividade fisica, Sono, Saude emocional, Habitos, Outros. Texto: ',
    };

    try{
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ch,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:800,
          messages:[{role:"user",content:(prompts[tipo]||"")+textoLivre}]
        })
      });
      const data=await res.json();
      const raw=(data.content?.[0]?.text||"[]").trim();
      const match=raw.match(/\[[\s\S]*\]/);
      if(!match){setProcessando(false);return;}
      const parsed=JSON.parse(match[0]);

      if(tipo==="receita")setMedicamentos(parsed);
      else if(tipo==="pedido_exame")setExames(parsed);
      else if(tipo==="estilo_vida")setEstiloVida(parsed);

      setModoTextoLivre(false);
    }catch(e){console.warn("Processamento IA falhou:",e);}
    finally{setProcessando(false);}
  };

  // ── Salvar ────────────────────────────────────────────────────────
  const handleSalvar=async()=>{
    setSalvando(true);

    const conteudo={
      tipo,motivo,conduta,orientacoes,retorno,cid,nomeDiag,
      dataConsulta,hora,tipoConsulta,
      medicamentos,exames,estiloVida,
    };

    // Log para debug — verificar se agendamentoId está chegando
    console.log("[HVV] Salvando documento — agendamentoId:", agendamentoId, "tipo:", tipo);

    const docBase={
      paciente_id:pac.id,medico_id:medico.id,
      titulo:TIPOS.find(t=>t.id===tipo)?.label||tipo,
      tipo:tipo==="estilo_vida"?"estilo_vida":tipo==="relatorio"?"relatorio":tipo,
      origem:"medico",
      resumo:motivo||conduta||(medicamentos[0]?.nome)||"",
      data:dataConsulta,
      agendamento_id:agendamentoId||null,
    };

    let docSalvo=null;
    const r1=await supabase.from("documentos").insert({...docBase,conteudo_json:conteudo}).select("id,created_at").single();
    if(r1.error){
      console.warn("[HVV] Erro r1:",r1.error.message,r1.error.details,r1.error.hint);
      const r2=await supabase.from("documentos").insert({...docBase,conteudo_json:JSON.stringify(conteudo)}).select("id,created_at").single();
      if(r2.error)console.warn("[HVV] Erro r2:",r2.error.message,r2.error.details);
      if(r2.data)docSalvo=r2.data;
    }else{docSalvo=r1.data;}
    if(docSalvo)onDocSalvo({...docSalvo,...conteudo,conteudo_json:conteudo,titulo:TIPOS.find(t=>t.id===tipo)?.label});

    // Extrair CIDs se consulta clínica
    if(tipo==="consulta"&&(motivo||conduta)){
      const ch=chave();
      console.log("[HVV CID] chave ok:", ch.startsWith("sk-"), "motivo:", !!motivo, "conduta:", !!conduta);
      if(ch.startsWith("sk-")){
        setProcessando(true);
        try{
          const texto=[motivo&&("Motivo: "+motivo),conduta&&("Conduta: "+conduta)].filter(Boolean).join(" | ");
          console.log("[HVV CID] Enviando para IA:", texto.slice(0,100));
          const res=await fetch("/.netlify/functions/claude",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-api-key":ch,"anthropic-version":"2023-06-01"},
            body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,
              messages:[{role:"user",content:"Voce e especialista CID-10. Leia o texto e retorne um array JSON onde cada item tem cid e nome. Exemplo: [{\"cid\":\"I10\",\"nome\":\"Hipertensao arterial\"}]. Retorne SOMENTE o array JSON. Texto: "+texto}]})
          });
          console.log("[HVV CID] Status resposta IA:", res.status);
          const data=await res.json();
          const raw=(data.content?.[0]?.text||"[]").trim();
          console.log("[HVV CID] Resposta IA:", raw.slice(0,200));
          const match=raw.match(/\[[\s\S]*\]/);
          if(match){
            const parsed=JSON.parse(match[0]);
            // Normalizar — IA pode retornar strings ou objetos
            const diags=parsed.map(d=>{
              if(typeof d==="string")return{cid:d,nome:d};
              return d;
            });
            console.log("[HVV CID] Diagnósticos normalizados:", diags.length, diags);
            const extraidos=[];
            for(const d of diags){
              if(d.cid&&d.nome){
                const cidNorm=d.cid.trim().toUpperCase();
                const nomeNorm=d.nome.trim();
                const{data:salvo,error:errDiag}=await supabase.from("diagnosticos").insert({
                  paciente_id:pac.id,
                  medico_id:medico.id,
                  cid:cidNorm,
                  nome:nomeNorm,
                  status:"ativo",
                  data:dataConsulta,
                }).select("id,cid,nome,status,data").single();
                if(errDiag){
                  console.warn("[HVV CID] Erro ao salvar diagnostico:",errDiag.message,errDiag.details,errDiag.hint);
                } else if(salvo){
                  console.log("[HVV CID] Diagnóstico salvo:", cidNorm, nomeNorm);
                  onDiagSalvo({...salvo});
                  extraidos.push({cid:cidNorm,nome:nomeNorm});
                }
              }
            }
            setDiagsExtraidos(extraidos);
            if(recarregarDiags)setTimeout(recarregarDiags,800);
          } else {
            console.warn("[HVV CID] Nenhum JSON encontrado na resposta:", raw);
          }
        }catch(e){console.warn("[HVV CID] Erro geral:", e);}
        finally{setProcessando(false);}
      }
    }

    // Agendar retorno
    if(agendarRetorno&&dataRetorno){
      await salvarAgendamento({paciente_id:pac.id,medico_id:medico.id,tipo:tipoConsulta,data:dataRetorno,hora:horaRetorno+":00",status:"agendado",resumo:"Retorno"});
    }

    setSalvando(false);setSalvo(true);
    setTimeout(()=>{setSalvo(false);setDiagsExtraidos([]);},4000);
    setMotivo("");setConduta("");setOrientacoes("");setRetorno("");setCid("");setNomeDiag("");
    setMedicamentos([]);setExames([]);setEstiloVida([]);setTextoLivre("");setModoTextoLivre(false);
    setAgendarRetorno(false);setDataRetorno("");
  };

  const tipoAtivo=TIPOS.find(t=>t.id===tipo);
  const podeProcesarIA=["receita","pedido_exame","estilo_vida"].includes(tipo);

  return(
    <div style={{maxWidth:820}}>

      {/* Aviso consulta encerrada */}
      {consultaEncerrada&&(
        <div style={{padding:"12px 16px",background:T.orangeBg,border:`1px solid ${T.orange}30`,borderRadius:8,marginBottom:16,fontSize:13,color:T.orange}}>
          Esta consulta foi encerrada. Para alterar um documento, emita um novo documento avulso abaixo.
        </div>
      )}

      {/* Cards de tipo */}
      <div ref={topoCards} style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {TIPOS.map(t=>(
          <button key={t.id} onClick={()=>{
  if(consultaEncerrada)return;
  if(docsConsultaAtiva.length>0&&tiposEmitidos.includes(t.id)){
    setModalDuplicata(t);
    return;
  }
  const mudar=()=>{
    setTipo(t.id);setModoTextoLivre(false);setTextoLivre("");
    setMedicamentos([]);setExames([]);setEstiloVida([]);
    setMotivo("");setConduta("");setOrientacoes("");setRetorno("");setCid("");setNomeDiag("");
    setTimeout(()=>formularioRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
  };
  trocarTipoComVerificacao(t.id,mudar);
}}
            style={{padding:"14px 16px",borderRadius:10,border:`1.5px solid ${tipo===t.id?T.green:T.border}`,
              background:tipo===t.id?T.greenBg:T.surface,cursor:consultaEncerrada?"not-allowed":"pointer",
              textAlign:"left",fontFamily:T.f,transition:"all 0.15s",opacity:consultaEncerrada?0.5:1}}
            onMouseOver={e=>{if(tipo!==t.id){e.currentTarget.style.borderColor=T.green;e.currentTarget.style.background=T.greenBg+"80";}}}
            onMouseOut={e=>{if(tipo!==t.id){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}}>
            <div style={{fontSize:22,marginBottom:6}}>{t.icon}</div>
            <div style={{fontSize:13,fontWeight:500,color:tipo===t.id?T.green:T.ink,marginBottom:2}}>{t.label}</div>
            <div style={{fontSize:11,color:T.inkFaint,lineHeight:1.5}}>{t.desc}</div>
            {docsConsultaAtiva.length>0&&tiposEmitidos.includes(t.id)&&(
              <div style={{marginTop:6,fontSize:10,color:T.green,fontWeight:500}}>✓ Emitido nesta consulta</div>
            )}
          </button>
        ))}
      </div>

      <div ref={formularioRef}/>
      <Card style={{padding:"20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500,color:T.ink}}>{tipoAtivo?.icon} {tipoAtivo?.label}</div>
          {podeProcesarIA&&(
            <button onClick={()=>setModoTextoLivre(!modoTextoLivre)}
              style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:`1px solid ${modoTextoLivre?T.green:T.border}`,
                background:modoTextoLivre?T.greenBg:T.surface,color:modoTextoLivre?T.green:T.inkMid,cursor:"pointer",fontFamily:T.f}}>
              {modoTextoLivre?"← Editar campos":"✦ Preencher com IA"}
            </button>
          )}
        </div>

        {/* Data e hora — sempre visível */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
          <Input label="Data" value={dataConsulta} onChange={setDataConsulta} type="date"/>
          <Input label="Horário" value={hora} onChange={setHora} type="time"/>
          <Select label="Tipo" value={tipoConsulta} onChange={setTipoConsulta} options={[{value:"teleconsulta",label:"Teleconsulta"},{value:"presencial",label:"Presencial"}]}/>
        </div>

        {/* Modo texto livre com IA */}
        {modoTextoLivre&&podeProcesarIA&&(
          <div style={{marginBottom:16}}>
            <div style={{padding:"10px 14px",background:T.blueBg,borderRadius:8,marginBottom:10,fontSize:12,color:T.blue,lineHeight:1.7}}>
              ✦ Escreva livremente — a IA vai identificar e estruturar os campos automaticamente.
              {tipo==="receita"&&" Ex: Losartana 50mg 1x ao dia, AAS 100mg à noite, uso contínuo"}
              {tipo==="pedido_exame"&&" Ex: Hemograma, creatinina e potássio para controle de HAS"}
              {tipo==="estilo_vida"&&" Ex: Reduzir sódio, caminhada 30min 5x por semana, dormir 7 a 8h"}
            </div>
            <Textarea value={textoLivre} onChange={setTextoLivre}
              placeholder={tipo==="receita"?"Descreva os medicamentos livremente...":tipo==="pedido_exame"?"Liste os exames e indicações...":"Descreva as orientações de estilo de vida..."}
              rows={4}/>
            <Btn onClick={processarComIA} disabled={processando||!textoLivre.trim()} style={{marginTop:10,width:"100%"}}>
              {processando?"Processando com IA...":"✦ Estruturar com IA →"}
            </Btn>
          </div>
        )}

        {/* ── RECEITA ── */}
        {tipo==="receita"&&!modoTextoLivre&&(
          <div>
            {medicamentos.length>0?(
              <div>
                <Lbl>Medicamentos prescritos</Lbl>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                  {medicamentos.map((m,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 2fr 1fr auto",gap:8,alignItems:"center",padding:"10px 12px",background:T.bgWarm,borderRadius:8}}>
                      <input value={m.nome} onChange={e=>setMedicamentos(prev=>prev.map((x,j)=>j===i?{...x,nome:e.target.value}:x))}
                        style={{padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,fontSize:12,color:T.ink,background:T.surface}}
                        placeholder="Medicamento"/>
                      <input value={m.dose} onChange={e=>setMedicamentos(prev=>prev.map((x,j)=>j===i?{...x,dose:e.target.value}:x))}
                        style={{padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,fontSize:12,color:T.ink,background:T.surface}}
                        placeholder="Dose"/>
                      <input value={m.posologia} onChange={e=>setMedicamentos(prev=>prev.map((x,j)=>j===i?{...x,posologia:e.target.value}:x))}
                        style={{padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,fontSize:12,color:T.ink,background:T.surface}}
                        placeholder="Posologia"/>
                      <input value={m.duracao} onChange={e=>setMedicamentos(prev=>prev.map((x,j)=>j===i?{...x,duracao:e.target.value}:x))}
                        style={{padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,fontSize:12,color:T.ink,background:T.surface}}
                        placeholder="Duração"/>
                      <button onClick={()=>setMedicamentos(prev=>prev.filter((_,j)=>j!==i))}
                        style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:16,padding:"0 4px"}}>×</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setMedicamentos(prev=>[...prev,{nome:"",dose:"",posologia:"",duracao:""}])}
                  style={{fontSize:12,color:T.green,background:"none",border:`1px dashed ${T.greenBorder}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:T.f,width:"100%"}}>
                  + Adicionar medicamento
                </button>
              </div>
            ):(
              <Textarea label="Medicamentos prescritos" value={conduta} onChange={setConduta}
                placeholder="Nome, dose, posologia e duração de cada medicamento..." rows={5}/>
            )}
          </div>
        )}

        {/* ── PEDIDO DE EXAMES ── */}
        {tipo==="pedido_exame"&&!modoTextoLivre&&(
          <ExameBuscador exames={exames} setExames={setExames} conduta={conduta} setConduta={setConduta} apiKey={apiKey}/>
        )}

        {/* ── ESTILO DE VIDA ── */}
        {tipo==="estilo_vida"&&!modoTextoLivre&&(
          <div>
            {estiloVida.length>0?(
              <div>
                <Lbl>Orientações de estilo de vida</Lbl>
                {["Alimentação","Atividade física","Sono","Saúde emocional","Hábitos","Outros"].map(cat=>{
                  const items=estiloVida.filter(e=>e.categoria===cat||e.categoria===cat.replace("ã","a").replace("ô","o"));
                  if(items.length===0)return null;
                  return(
                    <div key={cat} style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:6}}>{cat.toUpperCase()}</div>
                      {items.map((e,i)=>(
                        <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:T.green,flexShrink:0}}/>
                          <input value={e.orientacao} onChange={ev=>{
                            const idx=estiloVida.indexOf(e);
                            setEstiloVida(prev=>prev.map((x,j)=>j===idx?{...x,orientacao:ev.target.value}:x));
                          }} style={{flex:1,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:6,fontFamily:T.f,fontSize:12,color:T.ink,background:T.surface}}/>
                          <button onClick={()=>{const idx=estiloVida.indexOf(e);setEstiloVida(prev=>prev.filter((_,j)=>j!==idx));}}
                            style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:14}}>×</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ):(
              <Textarea label="Orientações de estilo de vida" value={conduta} onChange={setConduta}
                placeholder="Alimentação, atividade física, sono, hábitos..." rows={5}/>
            )}
          </div>
        )}

        {/* ── CONSULTA CLÍNICA ── */}
        {tipo==="consulta"&&(
          <>
            <div style={{marginBottom:12}}><Textarea label="Motivo da consulta" value={motivo} onChange={setMotivo} placeholder="Queixa principal e motivo do atendimento..." rows={2}/></div>
            <div style={{marginBottom:12}}><Textarea label="Conduta médica" value={conduta} onChange={setConduta} placeholder="Exame físico, hipótese diagnóstica, conduta..." rows={3}/></div>
            <div style={{marginBottom:12}}><Textarea label="Orientações ao paciente" value={orientacoes} onChange={setOrientacoes} placeholder="Orientações, restrições..." rows={2}/></div>
            <CidBuscador cid={cid} nomeDiag={nomeDiag} onSelect={(c,n)=>{setCid(c);setNomeDiag(n);}} apiKey={apiKey}/>
            <Input label="Retorno recomendado" value={retorno} onChange={setRetorno} placeholder="Ex: Em 30 dias"/>
          </>
        )}

        {/* ── ATESTADO ── */}
        {tipo==="atestado"&&(
          <>
            <div style={{marginBottom:12}}><Textarea label="Motivo do afastamento" value={motivo} onChange={setMotivo} placeholder="Diagnóstico e justificativa médica..." rows={2}/></div>
            <Input label="Período de afastamento" value={retorno} onChange={setRetorno} placeholder="Ex: 3 dias, de 22/04 a 24/04"/>
          </>
        )}

        {/* ── RELATÓRIO / ENCAMINHAMENTO ── */}
        {tipo==="relatorio"&&(
          <>
            <div style={{marginBottom:12}}><Textarea label="Histórico clínico resumido" value={motivo} onChange={setMotivo} placeholder="Histórico relevante..." rows={2}/></div>
            <Textarea label="Conteúdo do documento" value={conduta} onChange={setConduta} placeholder="Relatório completo / motivo do encaminhamento..." rows={5}/>
          </>
        )}
      </Card>

      {/* Agendar retorno */}
      {(tipo==="consulta"||tipo==="atestado")&&(
        <Card style={{padding:"14px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:agendarRetorno?14:0}}>
            <input type="checkbox" id="agendar" checked={agendarRetorno} onChange={e=>setAgendarRetorno(e.target.checked)}
              style={{width:16,height:16,accentColor:T.green}}/>
            <label htmlFor="agendar" style={{fontSize:13,color:T.ink,cursor:"pointer"}}>Agendar consulta de retorno</label>
          </div>
          {agendarRetorno&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <Input label="Data" value={dataRetorno} onChange={setDataRetorno} type="date"/>
              <Input label="Horário" value={horaRetorno} onChange={setHoraRetorno} type="time"/>
              <Select label="Tipo" value={tipoConsulta} onChange={setTipoConsulta} options={[{value:"teleconsulta",label:"Teleconsulta"},{value:"presencial",label:"Presencial"}]}/>
            </div>
          )}
        </Card>
      )}

      {/* Feedback */}
      {processando&&(
        <div style={{padding:"12px 16px",background:T.blueBg,borderRadius:8,marginBottom:12,fontSize:13,color:T.blue,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:14,height:14,border:`2px solid ${T.blue}40`,borderTop:`2px solid ${T.blue}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
          {tipo==="consulta"?"Extraindo diagnósticos com IA...":"Processando com IA..."}
        </div>
      )}
      {salvo&&(
        <div style={{padding:"12px 16px",background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:8,marginBottom:12}}>
          <div style={{fontSize:13,color:T.green,marginBottom:diagsExtraidos.length>0?6:0}}>✓ Documento salvo no prontuário{diagsExtraidos.length>0?" · "+diagsExtraidos.length+" diagnóstico(s) extraído(s)":""}</div>
          {diagsExtraidos.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {diagsExtraidos.map(d=><Badge key={d.cid} label={d.cid+" · "+d.nome} color={T.green} bg={T.greenBg}/>)}
            </div>
          )}
        </div>
      )}

      <Btn onClick={handleSalvar} disabled={salvando||consultaEncerrada} style={{width:"100%",padding:"12px"}}>
        {salvando?"Salvando...":"✓ Salvar no prontuário →"}
      </Btn>

      {/* Modal sair sem salvar */}
      {modalSairSemSalvar&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:420,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:8}}>⚠️ Dados não salvos</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.7,marginBottom:20}}>
              Você preencheu campos que ainda não foram salvos no prontuário. Se continuar, perderá o que foi registrado. Deseja mesmo sair sem salvar?
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModalSairSemSalvar(null)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Voltar e salvar
              </button>
              <button onClick={()=>{modalSairSemSalvar();setModalSairSemSalvar(null);}}
                style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:T.orange,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal duplicata */}
      {modalDuplicata&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
          <div style={{background:T.surface,borderRadius:12,padding:"28px",maxWidth:420,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:18,fontWeight:500,color:T.ink,marginBottom:8}}>Documento já emitido</div>
            <div style={{fontSize:13,color:T.inkMid,lineHeight:1.7,marginBottom:20}}>
              Você já emitiu um <strong>{modalDuplicata.label}</strong> nesta consulta. Deseja abrir para edição ou foi um clique por engano?
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModalDuplicata(null)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.inkMid,fontSize:13,cursor:"pointer",fontFamily:T.f}}>
                Cancelar
              </button>
              <button onClick={()=>{
                setTipo(modalDuplicata.id);
                setModoTextoLivre(false);setTextoLivre("");
                setMedicamentos([]);setExames([]);setEstiloVida([]);
                setMotivo("");setConduta("");setOrientacoes("");setRetorno("");setCid("");setNomeDiag("");
                setModalDuplicata(null);
              }} style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:T.green,color:"#FFF",fontSize:13,cursor:"pointer",fontFamily:T.f,fontWeight:500}}>
                Editar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Aba Documentos ───────────────────────────────────────────────
function AbaDocumentos({docs,pac,medico,onSalvo}){
  // Esta função não é mais usada — substituída por AbaEmitirDocumento
  return null;
}


// ─── Aba Diagnósticos ─────────────────────────────────────────────
function AbaDiagnosticos({diags,pac,medico,onSalvo}){
  const[cidManual,setCidManual]=useState("");
  const[nomeManual,setNomeManual]=useState("");
  const[status,setStatus]=useState("ativo");
  const[salvando,setSalvando]=useState(false);
  const STATUS_COR={ativo:T.red,monitoramento:T.orange,resolvido:T.green};

  const handleAdicionarManual=async()=>{
    if(!cidManual||!nomeManual)return;
    setSalvando(true);
    const{data}=await salvarDiagnostico({
      paciente_id:pac.id,medico_id:medico.id,
      cid:cidManual.trim().toUpperCase(),
      nome:nomeManual.trim(),
      status,data:dataHoje()
    });
    if(data){onSalvo({...data,cid:cidManual.trim().toUpperCase(),nome:nomeManual.trim(),status});setCidManual("");setNomeManual("");}
    setSalvando(false);
  };

  return(
    <div style={{maxWidth:800}}>

      {/* Nota */}
      <div style={{padding:"12px 16px",background:T.blueBg,border:`0.5px solid ${T.blue}30`,borderRadius:8,marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:16,flexShrink:0}}>✦</span>
        <div style={{fontSize:12,color:T.inkMid,lineHeight:1.7}}>
          Os diagnósticos são extraídos automaticamente ao salvar uma <strong>consulta clínica</strong> na aba "Registrar consulta" — a IA lê o texto e classifica os CIDs. Você pode também adicionar manualmente abaixo.
        </div>
      </div>

      {/* Adição manual */}
      <Card style={{padding:"16px 18px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:12}}>Adicionar diagnóstico manualmente</div>
        <div style={{display:"grid",gridTemplateColumns:"100px 1fr 140px auto",gap:10,alignItems:"flex-end"}}>
          <Input label="CID" value={cidManual} onChange={setCidManual} placeholder="I10"/>
          <Input label="Nome do diagnóstico" value={nomeManual} onChange={setNomeManual} placeholder="Hipertensão arterial"/>
          <Select label="Status" value={status} onChange={setStatus} options={[
            {value:"ativo",label:"Ativo"},
            {value:"monitoramento",label:"Monitoramento"},
            {value:"resolvido",label:"Resolvido"}
          ]}/>
          <Btn onClick={handleAdicionarManual} disabled={salvando||!cidManual||!nomeManual} small>
            {salvando?"...":"Adicionar"}
          </Btn>
        </div>
      </Card>

      {/* Lista */}
      <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:8}}>DIAGNÓSTICOS REGISTRADOS ({diags.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {diags.map(d=>(
          <Card key={d.id} style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:48,height:40,borderRadius:8,background:`${STATUS_COR[d.status]||T.ink}15`,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:11,fontWeight:700,color:STATUS_COR[d.status]||T.ink}}>{d.cid}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{d.nome}</div>
              <div style={{fontSize:11,color:T.inkFaint}}>{d.data}</div>
            </div>
            <Badge label={d.status} color={STATUS_COR[d.status]||T.ink}/>
          </Card>
        ))}
        {diags.length===0&&(
          <div style={{textAlign:"center",padding:"32px",color:T.inkFaint,fontSize:13}}>
            <div style={{fontSize:28,marginBottom:8}}>🎯</div>
            Nenhum diagnóstico ainda — registre uma consulta e os CIDs serão extraídos automaticamente
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Aba Medicamentos ────────────────────────────────────────────
function AbaMedicamentos({meds,pac,plano=[]}){
  // Medicamentos ativos no plano de cuidado
  const medsAtivosPlano=plano.filter(t=>
    t.ativo!==false&&t.categoria==="medicamento"&&t.origem==="medico"
  );

  return(
    <div style={{maxWidth:800}}>

      {/* Seção: Medicamentos ativos no plano */}
      {medsAtivosPlano.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
            Medicamentos ativos no plano de cuidado ({medsAtivosPlano.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {medsAtivosPlano.map(t=>(
              <div key={t.id} style={{padding:"14px 16px",background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:10,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22,flexShrink:0}}>💊</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.greenDark}}>{t.titulo}</div>
                  {t.descricao&&<div style={{fontSize:12,color:T.inkMid,marginTop:2}}>{t.descricao}</div>}
                </div>
                <Badge label={t.frequencia==="diario"?"Diário":t.frequencia==="n_vezes_semana"?t.meta_semanal+"×/sem":t.frequencia} color={T.green} bg="white"/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção: Histórico de prescrições */}
      <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
        Histórico de prescrições ({meds.length})
      </div>

      {meds.length===0?(
        <div style={{textAlign:"center",padding:"32px",color:T.inkFaint,fontSize:13,background:T.bgWarm,borderRadius:10}}>
          <div style={{fontSize:28,marginBottom:8}}>💊</div>
          Nenhuma prescrição registrada
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {meds.map(doc=>{
            const mlist=doc.medicamentos||[];
            const texto=doc.conduta||"";
            return(
              <div key={doc.id} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,overflow:"hidden",borderLeft:`3px solid ${T.green}`}}>
                <div style={{padding:"12px 16px",borderBottom:mlist.length>0||texto?`0.5px solid ${T.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.ink}}>Prescrição · {doc.data}</div>
                  <Badge label={mlist.length>0?mlist.length+" medicamentos":"Texto livre"} color={T.green} bg={T.greenBg}/>
                </div>
                {mlist.length>0&&(
                  <div style={{padding:"12px 16px"}}>
                    {mlist.map((m,i)=>(
                      <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8,paddingBottom:8,borderBottom:i<mlist.length-1?`0.5px solid ${T.border}`:"none"}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:T.green,flexShrink:0,marginTop:5}}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{m.nome} {m.dose}</div>
                          <div style={{fontSize:12,color:T.inkMid}}>{m.posologia}{m.duracao&&` · ${m.duracao}`}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!mlist.length&&texto&&(
                  <div style={{padding:"12px 16px",fontSize:13,color:T.inkMid,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{texto}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Aba Exames ───────────────────────────────────────────────────
function AbaExames({exames,pac}){
  if(exames.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
      <div style={{fontSize:32,marginBottom:12}}>🔬</div>
      <div>Nenhum pedido de exame registrado</div>
      <div style={{fontSize:12,marginTop:6}}>Emita um pedido na aba Emitir documento</div>
    </div>
  );
  return(
    <div style={{maxWidth:800,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:4}}>PEDIDOS DE EXAME ({exames.length})</div>
      {exames.map(doc=>{
        const elist=doc.exames||[];
        const texto=doc.conduta||"";
        return(
          <div key={doc.id} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,overflow:"hidden",borderLeft:`3px solid ${T.purple}`}}>
            <div style={{padding:"12px 16px",borderBottom:elist.length>0||texto?`0.5px solid ${T.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:500,color:T.ink}}>Pedido de exames · {doc.data}</div>
              <Badge label={elist.length>0?elist.length+" exames":"Texto livre"} color={T.purple} bg={T.purpleBg}/>
            </div>
            {elist.length>0&&(
              <div style={{padding:"12px 16px"}}>
                {elist.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8,paddingBottom:8,borderBottom:i<elist.length-1?`0.5px solid ${T.border}`:"none"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:T.purple,flexShrink:0,marginTop:5}}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{e.nome}</div>
                      {e.indicacao&&<div style={{fontSize:12,color:T.inkMid}}>{e.indicacao}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!elist.length&&texto&&(
              <div style={{padding:"12px 16px",fontSize:13,color:T.inkMid,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{texto}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Aba Estilo de Vida ──────────────────────────────────────────
function AbaEstiloVida({docs,pac}){
  const CATS=["Alimentação","Atividade física","Sono","Saúde emocional","Hábitos","Outros"];
  const CAT_ICON={"Alimentação":"🥗","Atividade física":"🏃","Sono":"😴","Saúde emocional":"🧘","Hábitos":"✅","Outros":"📝"};
  const CAT_COR={"Alimentação":T.green,"Atividade física":T.blue,"Sono":T.purple,"Saúde emocional":T.orange,"Hábitos":T.green,"Outros":T.inkMid};

  if(docs.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
      <div style={{fontSize:32,marginBottom:12}}>🌿</div>
      <div>Nenhuma prescrição de estilo de vida registrada</div>
      <div style={{fontSize:12,marginTop:6}}>Emita uma prescrição na aba Emitir documento</div>
    </div>
  );

  // Consolidar todas as orientações por categoria
  const todasOrientacoes=[];
  docs.forEach(doc=>{
    const list=doc.estiloVida||[];
    const texto=doc.conduta||"";
    if(list.length>0){
      list.forEach(e=>todasOrientacoes.push({...e,data:doc.data,docId:doc.id}));
    } else if(texto){
      todasOrientacoes.push({categoria:"Outros",orientacao:texto,data:doc.data,docId:doc.id});
    }
  });

  // Agrupar por categoria
  const porCat={};
  todasOrientacoes.forEach(o=>{
    const cat=o.categoria||"Outros";
    if(!porCat[cat])porCat[cat]=[];
    porCat[cat].push(o);
  });

  return(
    <div style={{maxWidth:800}}>
      {/* Visão consolidada por categoria */}
      {CATS.filter(cat=>porCat[cat]?.length>0).map(cat=>(
        <div key={cat} style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>{CAT_ICON[cat]||"📝"}</span>
            <div style={{fontSize:14,fontWeight:500,color:CAT_COR[cat]||T.ink}}>{cat}</div>
            <Badge label={`${porCat[cat].length} orientação${porCat[cat].length>1?"ões":""}`} color={CAT_COR[cat]||T.ink}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:26}}>
            {porCat[cat].map((o,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 14px",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:8,borderLeft:`3px solid ${CAT_COR[cat]||T.green}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.ink,lineHeight:1.6}}>{o.orientacao}</div>
                </div>
                <div style={{fontSize:10,color:T.inkFaint,flexShrink:0,marginTop:2}}>{o.data}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Histórico de prescrições */}
      {docs.length>1&&(
        <div style={{marginTop:20,paddingTop:16,borderTop:`0.5px solid ${T.border}`}}>
          <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.1em",marginBottom:10}}>HISTÓRICO DE PRESCRIÇÕES</div>
          {docs.map(doc=>(
            <div key={doc.id} style={{fontSize:12,color:T.inkMid,marginBottom:4}}>
              {doc.data} · {doc.estiloVida?.length||0} orientação{(doc.estiloVida?.length||0)!==1?"ões":""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Episódios Médico ────────────────────────────────────────
function AbaEpisodiosMedico({episodios,pac,medico,onAtualizar}){
  const[mostrarVincular,setMostrarVincular]=useState(false);
  const[episodiosDisp,setEpisodiosDisp]=useState([]);
  const[epSelecionado,setEpSelecionado]=useState("");
  const[dataInicio,setDataInicio]=useState(dataHoje());
  const[salvando,setSalvando]=useState(false);
  const[expandido,setExpandido]=useState(null);

  useEffect(()=>{
    if(mostrarVincular)carregarEpisodiosDisponiveis().then(setEpisodiosDisp);
  },[mostrarVincular]);

  const handleVincular=async()=>{
    const ep=episodiosDisp.find(e=>e.id===epSelecionado);
    if(!ep)return;
    setSalvando(true);
    const{error}=await vincularEpisodio(pac.id,ep.id,medico.id,dataInicio,ep.duracao_meses);
    if(!error){onAtualizar();setMostrarVincular(false);setEpSelecionado("");}
    setSalvando(false);
  };

  // Calcular progresso de cada episódio
  const calcProgresso=(pe)=>{
    const ep=pe.episodios;
    if(!ep)return null;
    const acoes=ep.episodio_acoes||[];
    const dataIni=new Date(pe.data_inicio+"T12:00:00");
    const hoje=new Date();
    const diasPassados=Math.floor((hoje-dataIni)/(1000*60*60*24));

    const etapasVencidas=acoes.filter(a=>(a.dia_inicio||0)<=diasPassados);
    const etapasFuturas=acoes.filter(a=>(a.dia_inicio||0)>diasPassados);
    const proximaEtapa=etapasFuturas.sort((a,b)=>(a.dia_inicio||0)-(b.dia_inicio||0))[0];
    const pct=acoes.length>0?Math.round(etapasVencidas.length/acoes.length*100):0;

    return{diasPassados,etapasVencidas,etapasFuturas,proximaEtapa,pct,acoes};
  };

  const STATUS_COR={ativo:T.green,concluido:T.blue,abandonado:T.red,renovado:T.orange};
  const TIPO_ICON={consulta:"🩺",exame:"🔬",medicamento:"💊",estilo_vida:"🌿",questionario:"📝",desfecho_clinico:"🎯",desfecho_pro:"📊",outro:"📋"};

  return(
    <div style={{maxWidth:860}}>

      {/* Vincular novo episódio */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:T.inkMid}}>{episodios.filter(e=>e.status==="ativo").length} episódio(s) ativo(s)</div>
        <Btn small onClick={()=>setMostrarVincular(!mostrarVincular)}>
          {mostrarVincular?"Cancelar":"+ Vincular episódio"}
        </Btn>
      </div>

      {mostrarVincular&&(
        <Card style={{padding:"16px",marginBottom:16,border:`1px solid ${T.greenBorder}`,background:T.greenBg}}>
          <div style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:12}}>Vincular paciente a um episódio clínico</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:10,alignItems:"flex-end"}}>
            <div>
              <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:5}}>EPISÓDIO</div>
              <select value={epSelecionado} onChange={e=>setEpSelecionado(e.target.value)}
                style={{width:"100%",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontFamily:T.f,fontSize:13,color:T.ink,background:T.surface}}>
                <option value="">Selecionar episódio...</option>
                {episodiosDisp.map(e=>(
                  <option key={e.id} value={e.id}>
                    {e.nome}{e.cid_principal?" ("+e.cid_principal+")":""} — {e.duracao_meses}m
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:5}}>DATA DE INÍCIO</div>
              <input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)}
                style={{width:"100%",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontFamily:T.f,fontSize:13,color:T.ink}}/>
            </div>
            <Btn onClick={handleVincular} disabled={salvando||!epSelecionado}>
              {salvando?"...":"Vincular →"}
            </Btn>
          </div>
        </Card>
      )}

      {episodios.length===0?(
        <Card style={{padding:"40px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>🏥</div>
          <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:6}}>Nenhum episódio ativo</div>
          <div style={{fontSize:12,color:T.inkMid}}>Vincule o paciente a um protocolo clínico</div>
        </Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {episodios.map(pe=>{
            const ep=pe.episodios;
            const prog=calcProgresso(pe);
            const aberto=expandido===pe.id;
            const cor=STATUS_COR[pe.status]||T.green;
            const dataFim=pe.data_fim_prevista?new Date(pe.data_fim_prevista+"T12:00:00"):null;
            const diasRestantes=dataFim?Math.ceil((dataFim-new Date())/(1000*60*60*24)):null;

            return(
              <Card key={pe.id} style={{padding:"0",overflow:"hidden",cursor:"pointer",borderLeft:`3px solid ${cor}`}}
                onClick={()=>setExpandido(aberto?null:pe.id)}>

                {/* Header */}
                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <div style={{fontSize:14,fontWeight:500,color:T.ink}}>{ep?.nome||"Episódio"}</div>
                      <Badge label={pe.status} color={cor}/>
                      {pe.numero_ciclo>1&&<Badge label={"Ciclo "+pe.numero_ciclo} color={T.blue}/>}
                    </div>
                    <div style={{fontSize:12,color:T.inkMid}}>
                      Início: {pe.data_inicio}
                      {diasRestantes!=null&&pe.status==="ativo"&&(
                        <span style={{marginLeft:12,color:diasRestantes<30?T.red:diasRestantes<90?T.orange:T.inkMid}}>
                          {diasRestantes>0?diasRestantes+" dias restantes":"Vencido"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progresso */}
                  {prog&&(
                    <div style={{textAlign:"center",minWidth:64}}>
                      <div style={{fontSize:20,fontWeight:700,color:cor}}>{prog.pct}%</div>
                      <div style={{fontSize:9,color:T.inkFaint}}>concluído</div>
                      <div style={{width:60,height:4,background:T.border,borderRadius:2,marginTop:4,overflow:"hidden"}}>
                        <div style={{width:prog.pct+"%",height:"100%",background:cor,borderRadius:2}}/>
                      </div>
                    </div>
                  )}
                  <span style={{fontSize:12,color:T.inkFaint}}>{aberto?"▲":"▼"}</span>
                </div>

                {/* Timeline expandida */}
                {aberto&&prog&&(
                  <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 18px",background:T.bgWarm}}>

                    {/* Próxima etapa */}
                    {prog.proximaEtapa&&(
                      <div style={{padding:"10px 14px",background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:8,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16}}>{TIPO_ICON[prog.proximaEtapa.tipo]||"📋"}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:500,color:T.greenDark}}>Próxima etapa</div>
                          <div style={{fontSize:13,color:T.ink}}>{prog.proximaEtapa.titulo}</div>
                        </div>
                        <Badge label={"Dia "+(prog.proximaEtapa.dia_inicio||0)} color={T.green}/>
                      </div>
                    )}

                    {/* Todas as etapas */}
                    <div style={{fontSize:10,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:8}}>TODAS AS ETAPAS</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {prog.acoes.sort((a,b)=>(a.dia_inicio||0)-(b.dia_inicio||0)).map(acao=>{
                        const diasAcao=acao.dia_inicio||0;
                        const cumprida=diasAcao<=prog.diasPassados;
                        const vencida=cumprida; // por ora tratamos vencida = chegou o dia
                        const diaLabel=diasAcao===0?"Início":diasAcao<30?"Dia "+diasAcao:diasAcao%30===0?"Mês "+(diasAcao/30):"Dia "+diasAcao;
                        return(
                          <div key={acao.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
                            background:cumprida?T.greenBg:T.surface,borderRadius:8,
                            border:`0.5px solid ${cumprida?T.greenBorder:T.border}`}}>
                            <span style={{fontSize:14}}>{cumprida?"✓":TIPO_ICON[acao.tipo]||"📋"}</span>
                            <div style={{flex:1,fontSize:12,color:cumprida?T.greenDark:T.ink}}>{acao.titulo}</div>
                            <Badge label={diaLabel} color={cumprida?T.green:T.inkLight}/>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ações rápidas */}
                    {pe.status==="ativo"&&(
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        <Btn small variant="outline" onClick={async(e)=>{
                          e.stopPropagation();
                          if(window.confirm("Encerrar este episódio como concluído?")){{
                            await supabase.from("paciente_episodios").update({status:"concluido",data_fim_real:dataHoje()}).eq("id",pe.id);
                            onAtualizar();
                          }}
                        }}>Marcar concluído</Btn>
                        <Btn small variant="ghost" style={{color:T.orange}} onClick={async(e)=>{
                          e.stopPropagation();
                          if(window.confirm("Abandonar este episódio?")){{
                            await supabase.from("paciente_episodios").update({status:"abandonado",data_fim_real:dataHoje()}).eq("id",pe.id);
                            onAtualizar();
                          }}
                        }}>Abandonar</Btn>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Aba Plano Médico ────────────────────────────────────────────
function AbaPlanoMedico({plano,registros,episodios=[],pac,medico,onAtualizar}){
  const FREQ_LABEL={diario:"Diário",n_vezes_semana:"N×/semana",uma_vez_semana:"1×/semana",uma_vez_mes:"1×/mês",unico:"Único"};
  const CAT_COR={medicamento:T.green,exame:T.purple,estilo_vida:T.blue,orientacao:T.orange};
  const CAT_ICON={medicamento:"💊",exame:"🔬",estilo_vida:"🌿",orientacao:"📋"};

  // Calcular adesão por tarefa (últimos 30 dias)
  const calcAdesao=(tarefaId)=>{
    const regs=registros.filter(r=>r.tarefa_id===tarefaId||r.plano_id===tarefaId);
    if(regs.length===0)return null;
    return regs.length;
  };

  const ativas=plano.filter(t=>t.ativo!==false);
  const porOrigem={
    episodio: ativas.filter(t=>t.categoria==="episodio"),
    medico: ativas.filter(t=>t.origem==="medico"&&t.categoria!=="episodio"),
    ana: ativas.filter(t=>(t.origem==="ana"||t.origem==="ia"||!t.origem)&&t.categoria!=="episodio"),
    sistema: ativas.filter(t=>t.origem==="sistema"&&t.categoria!=="episodio"),
  };

  if(plano.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
      <div style={{fontSize:32,marginBottom:12}}>📋</div>
      <div>Nenhuma tarefa no plano de cuidado</div>
      <div style={{fontSize:12,marginTop:6,marginBottom:20}}>As tarefas são geradas ao encerrar uma consulta</div>
      <button onClick={onAtualizar}
        style={{fontSize:12,padding:"7px 16px",border:`1px solid ${T.border}`,borderRadius:8,background:T.surface,color:T.inkMid,cursor:"pointer",fontFamily:T.f}}>
        🔄 Atualizar
      </button>
    </div>
  );

  // Mapear quais tarefas vêm de episódios
  const tarefasDeEpisodio=new Set(
    plano.filter(t=>t.consulta_id||t.categoria==="exame"||t.origem==="medico")
      .map(t=>t.id)
  );

  const SecaoPlano=({titulo,tarefas,cor,faint})=>(
    tarefas.length===0?null:(
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:500,color:T.inkFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
          {titulo} ({tarefas.length})
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tarefas.map(t=>{
            const adesao=calcAdesao(t.id);
            const catCor=CAT_COR[t.categoria]||cor||T.green;
            return(
              <div key={t.id} style={{padding:"14px 16px",background:faint?T.bgWarm:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,borderLeft:`3px solid ${catCor}`,opacity:faint?0.7:1}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <span style={{fontSize:18,flexShrink:0}}>{CAT_ICON[t.categoria]||"📋"}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{t.titulo}</div>
                      {t.categoria==="exame"&&episodios.some(pe=>pe.status==="ativo")&&(
                        <Badge label="🏥 Episódio" color={T.green} bg={T.greenBg}/>
                      )}
                    </div>
                    {t.descricao&&<div style={{fontSize:11,color:T.inkMid,marginBottom:6}}>{t.descricao}</div>}
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <Badge label={FREQ_LABEL[t.frequencia_tipo]||t.frequencia_tipo} color={catCor}/>
                      {t.frequencia_tipo==="n_vezes_semana"&&t.meta_semanal&&(
                        <Badge label={t.meta_semanal+"×/sem"} color={T.inkLight}/>
                      )}
                      {adesao!==null&&(
                        <span style={{fontSize:11,color:T.inkMid}}>
                          {adesao} registro{adesao!==1?"s":""} nos últimos 30 dias
                        </span>
                      )}
                      {adesao===null&&(
                        <span style={{fontSize:11,color:T.inkFaint,fontStyle:"italic"}}>Sem registros ainda</span>
                      )}
                    </div>
                  </div>
                  {/* Barra de adesão */}
                  {t.frequencia_tipo==="diario"&&adesao!==null&&(
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:700,color:adesao>=20?T.green:adesao>=10?T.orange:T.red}}>{Math.round(adesao/30*100)}%</div>
                      <div style={{fontSize:9,color:T.inkFaint}}>adesão</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  return(
    <div style={{maxWidth:800}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:T.inkMid}}>{ativas.length} tarefa{ativas.length!==1?"s":""} ativas · adesão calculada nos últimos 30 dias</div>
        <button onClick={onAtualizar}
          style={{fontSize:12,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:8,background:T.surface,color:T.inkMid,cursor:"pointer",fontFamily:T.f}}>
          Atualizar
        </button>
      </div>
      {/* Episódios — sempre no topo */}
      {porOrigem.episodio.length>0&&(
        <>
          <SecaoPlano titulo="🏥 Protocolo clínico — hoje" tarefas={porOrigem.episodio.filter(t=>t.visivel_a_partir!=="proxima")} cor={T.green}/>
          <SecaoPlano titulo="🏥 Protocolo clínico — em breve" tarefas={porOrigem.episodio.filter(t=>t.visivel_a_partir==="proxima")} cor={T.greenBorder} faint/>
        </>
      )}
      {/* Tarefas ativas */}
      <SecaoPlano titulo="Prescritas pelo médico" tarefas={porOrigem.medico.filter(t=>t.visivel_a_partir!=="proxima")} cor={T.green}/>
      <SecaoPlano titulo="Geradas pela Ana" tarefas={porOrigem.ana.filter(t=>t.visivel_a_partir!=="proxima")} cor={T.blue}/>
      <SecaoPlano titulo="Sistema" tarefas={porOrigem.sistema.filter(t=>t.visivel_a_partir!=="proxima")} cor={T.inkMid}/>
      {/* Tarefas futuras */}
      {ativas.filter(t=>t.visivel_a_partir==="proxima"&&t.categoria!=="episodio").length>0&&(
        <div style={{marginTop:8,paddingTop:16,borderTop:`0.5px solid ${T.border}`}}>
          <div style={{fontSize:11,color:T.inkFaint,letterSpacing:"0.08em",marginBottom:12}}>EM BREVE</div>
          <SecaoPlano titulo="" tarefas={ativas.filter(t=>t.visivel_a_partir==="proxima"&&t.categoria!=="episodio")} cor={T.inkLight} faint/>
        </div>
      )}
    </div>
  );
}

// ─── Aba Desfechos ────────────────────────────────────────────────
function AbaDesfechos({pac,medico}){
  const[desfechos,setDesfechos]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    carregarDesfechos(pac.id).then(setDesfechos).finally(()=>setLoading(false));
  },[pac.id]);

  if(loading)return<div style={{textAlign:"center",paddingTop:40}}><Spinner/></div>;

  if(desfechos.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:T.inkFaint}}>
      <div style={{fontSize:32,marginBottom:12}}>🎯</div>
      <div>Nenhum desfecho registrado</div>
      <div style={{fontSize:12,marginTop:6}}>Os desfechos são gerados automaticamente ao registrar diagnósticos com CID configurado</div>
    </div>
  );

  return(
    <div style={{maxWidth:800,display:"flex",flexDirection:"column",gap:10}}>
      {desfechos.map(d=>(
        <Card key={d.id} style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{d.desfechos_config?.titulo||"Desfecho"}</div>
            <div style={{fontSize:11,color:T.inkFaint}}>{d.data}</div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {d.valor_numerico!=null&&(
              <div style={{fontSize:22,fontWeight:700,color:d.fora_da_meta?T.red:T.green}}>{d.valor_numerico}</div>
            )}
            {d.valor_texto&&<div style={{fontSize:13,color:T.inkMid}}>{d.valor_texto}</div>}
            {d.valor_booleano!=null&&<Badge label={d.valor_booleano?"Sim":"Não"} color={d.valor_booleano?T.green:T.red}/>}
            {d.fora_da_meta&&<Badge label="Fora da meta" color={T.red} bg={T.redBg}/>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Agenda ───────────────────────────────────────────────────────
function TelaAgenda({medico,agenda,pacientes,onAtualizar,onAbrirPaciente}){
  const[showForm,setShowForm]=useState(false);
  const[pacId,setPacId]=useState("");
  const[data,setData]=useState(dataHoje());
  const[hora,setHora]=useState("09:00");
  const[tipo,setTipo]=useState("teleconsulta");
  const[duracao,setDuracao]=useState("30");
  const[salvando,setSalvando]=useState(false);

  const[periodo,setPeriodo]=useState("proximos"); // proximos | passados | todos
  const hoje=dataHoje();

  const agendaFiltrada=agenda.filter(a=>{
    if(periodo==="proximos")return a.data>=hoje;
    if(periodo==="passados")return a.data<hoje;
    return true;
  }).sort((a,b)=>periodo==="passados"?b.data>a.data?1:-1:a.data>b.data?1:-1);

  // Agrupar por data
  const porData={};
  agendaFiltrada.forEach(ag=>{
    if(!porData[ag.data])porData[ag.data]=[];
    porData[ag.data].push(ag);
  });

  const agendaHoje=agenda.filter(a=>a.data===hoje);

  const handleAgendar=async()=>{
    if(!pacId||!data||!hora)return;

    // Bloquear horário no passado
    const agDt=new Date(data+"T"+hora);
    if(agDt<new Date()){
      alert("Não é possível agendar para um horário que já passou.");
      return;
    }

    // Bloquear conflito com agendamento existente (mesmo dia e hora)
    const conflito=agenda.find(ag=>{
      if(ag.status==="cancelado"||ag.status==="bloqueado")return false;
      return ag.data===data&&ag.hora?.slice(0,5)===hora;
    });
    if(conflito){
      alert("Já existe uma consulta agendada para "+data+" às "+hora+". Escolha outro horário.");
      return;
    }

    setSalvando(true);
    await salvarAgendamento({
      paciente_id:pacId,medico_id:medico.id,
      tipo,data,hora:hora+":00",
      duracao:Number(duracao),status:"agendado",
    });
    await onAtualizar();
    setSalvando(false);setShowForm(false);
    setPacId("");setData(dataHoje());setHora("09:00");
  };

  const AgItem=({ag})=>(
    <div style={{padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"background 0.12s"}}
      onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
      onMouseOut={e=>e.currentTarget.style.background="transparent"}>
      <div style={{textAlign:"center",width:48,flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:600,color:T.ink}}>{ag.hora?.slice(0,5)}</div>
        <div style={{fontSize:9,color:T.inkFaint}}>{ag.duracao||30}min</div>
      </div>
      <div style={{width:1,height:36,background:T.border,flexShrink:0}}/>
      <Avatar nome={ag.pacientes?.nome||"?"} size={32}/>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{ag.pacientes?.nome||"—"}</div>
        <div style={{fontSize:11,color:T.inkMid,textTransform:"capitalize"}}>{ag.tipo}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Badge label={ag.status} color={ag.status==="confirmado"?T.green:ag.status==="cancelado"?T.red:T.orange}/>
        {ag.tipo==="teleconsulta"&&<span style={{fontSize:16}}>📹</span>}
      </div>
    </div>
  );

  const[showBloqueio,setShowBloqueio]=useState(false);
  const[bloqInicio,setBloqInicio]=useState(dataHoje());
  const[bloqHoraInicio,setBloqHoraInicio]=useState("08:00");
  const[bloqFim,setBloqFim]=useState(dataHoje());
  const[bloqHoraFim,setBloqHoraFim]=useState("18:00");
  const[bloqMotivo,setBloqMotivo]=useState("");
  const[bloqConflitos,setBloqConflitos]=useState([]);
  const[bloqSalvando,setBloqSalvando]=useState(false);

  const verificarConflitos=useCallback((inicio,horaInicio,fim,horaFim)=>{
    const dtInicio=new Date(`${inicio}T${horaInicio}`);
    const dtFim=new Date(`${fim}T${horaFim}`);
    const conflitos=agenda.filter(ag=>{
      if(ag.status==="cancelado"||ag.status==="bloqueado")return false;
      const agDt=new Date(`${ag.data}T${ag.hora||"00:00"}`);
      return agDt>=dtInicio&&agDt<=dtFim;
    });
    setBloqConflitos(conflitos);
  },[agenda]);

  const handleBloqDatas=(campo,val)=>{
    const ni=campo==="inicio"?val:bloqInicio;
    const nhi=campo==="horaInicio"?val:bloqHoraInicio;
    const nf=campo==="fim"?val:bloqFim;
    const nhf=campo==="horaFim"?val:bloqHoraFim;
    if(campo==="inicio")setBloqInicio(val);
    if(campo==="horaInicio")setBloqHoraInicio(val);
    if(campo==="fim")setBloqFim(val);
    if(campo==="horaFim")setBloqHoraFim(val);
    verificarConflitos(ni,nhi,nf,nhf);
  };

  const handleSalvarBloqueio=async()=>{
    if(!bloqMotivo)return;
    setBloqSalvando(true);

    // 1. Salvar o bloqueio
    await salvarBloqueio({
      medico_id:medico.id,
      data:bloqInicio,
      hora:bloqHoraInicio+":00",
      data_fim:bloqFim,
      hora_fim:bloqHoraFim+":00",
      motivo:bloqMotivo,
    });

    // 2. Para cada consulta em conflito — enviar mensagem ao paciente e registrar remarcação pendente
    for(const ag of bloqConflitos){
      const motivos={
        "Férias":"estará de férias",
        "Problema de saúde":"estará afastado por motivo de saúde",
        "Congresso / capacitação":"estará em congresso médico",
        "Imprevisto":"teve um imprevisto",
        "Outro":"estará indisponível",
      };
      const textoMotivo=motivos[bloqMotivo]||"estará indisponível";
      const msg=`Olá! Informamos que o Dr(a). ${medico.nome} ${textoMotivo} no período de ${bloqInicio} a ${bloqFim} e sua consulta agendada para ${ag.data} às ${ag.hora?.slice(0,5)} precisará ser remarcada. Por favor, acesse o aplicativo ou entre em contato com a equipe HVV para escolher um novo horário. Pedimos desculpas pelo inconveniente.`;

      // Enviar mensagem ao paciente
      await supabase.from("mensagens").insert({
        paciente_id:ag.paciente_id,
        medico_id:medico.id,
        conteudo:msg,
        remetente:"medico",
        tipo:"remarcacao",
      });

      // Marcar agendamento como remarcação pendente
      await supabase.from("agendamentos")
        .update({status:"remarcacao_pendente",resumo:`Remarcação necessária — ${bloqMotivo}`})
        .eq("id",ag.id);
    }

    await onAtualizar();
    setBloqSalvando(false);
    setShowBloqueio(false);
    setBloqMotivo("");
    setBloqConflitos([]);
    setBloqInicio(dataHoje());
    setBloqFim(dataHoje());
  };

  return(
    <div style={{flex:1,overflowY:"auto",padding:"28px"}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:20,fontWeight:500,color:T.ink}}>Agenda</div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>{setShowBloqueio(!showBloqueio);setShowForm(false);}} variant={showBloqueio?"outline":"ghost"}
              style={{fontSize:12,color:showBloqueio?T.inkMid:T.red,borderColor:showBloqueio?T.border:T.red+"40",border:"1px solid"}}>
              {showBloqueio?"Cancelar":"🚫 Marcar indisponibilidade"}
            </Btn>
            <Btn onClick={()=>{setShowForm(!showForm);setShowBloqueio(false);}} variant={showForm?"outline":"primary"}>
              {showForm?"Cancelar":"+ Novo agendamento"}
            </Btn>
          </div>
        </div>

        {/* Formulário de agendamento */}
        {showForm&&(
          <Card style={{padding:"20px",marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:14}}>Novo agendamento</div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:10,alignItems:"flex-end"}}>
              <Select label="Paciente" value={pacId} onChange={setPacId}
                options={[{value:"",label:"Selecionar..."},...pacientes.map(p=>({value:p.id,label:p.nome}))]}/>
              <Input label="Data" value={data} onChange={setData} type="date"/>
              <Input label="Horário" value={hora} onChange={setHora} type="time"/>
              <Select label="Tipo" value={tipo} onChange={setTipo} options={[{value:"teleconsulta",label:"Teleconsulta"},{value:"presencial",label:"Presencial"}]}/>
              <Btn onClick={handleAgendar} disabled={salvando||!pacId} style={{padding:"10px 16px"}}>
                {salvando?"...":"Agendar"}
              </Btn>
            </div>
          </Card>
        )}

        {/* Formulário de bloqueio */}
        {showBloqueio&&(
          <Card style={{padding:"20px",marginBottom:20,border:`1px solid ${T.red}30`,background:"rgba(163,45,45,0.02)"}}>
            <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:4}}>Marcar indisponibilidade</div>
            <div style={{fontSize:12,color:T.inkMid,marginBottom:16,lineHeight:1.6}}>
              Defina o período em que não estará disponível. Se houver consultas agendadas, os pacientes receberão um aviso automático solicitando remarcação.
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:14}}>
              <Input label="Data início" value={bloqInicio} onChange={v=>handleBloqDatas("inicio",v)} type="date"/>
              <Input label="Hora início" value={bloqHoraInicio} onChange={v=>handleBloqDatas("horaInicio",v)} type="time"/>
              <Input label="Data fim" value={bloqFim} onChange={v=>handleBloqDatas("fim",v)} type="date"/>
              <Input label="Hora fim" value={bloqHoraFim} onChange={v=>handleBloqDatas("horaFim",v)} type="time"/>
            </div>

            {/* Motivo — campo obrigatório */}
            <div style={{marginBottom:14}}>
              <Lbl>Motivo da indisponibilidade</Lbl>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["Férias","Problema de saúde","Congresso / capacitação","Imprevisto","Outro"].map(m=>(
                  <button key={m} onClick={()=>setBloqMotivo(m)}
                    style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${bloqMotivo===m?T.red:T.border}`,
                      background:bloqMotivo===m?T.redBg:T.surface,color:bloqMotivo===m?T.red:T.inkMid,
                      fontSize:12,cursor:"pointer",fontFamily:T.f,fontWeight:bloqMotivo===m?500:400}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Conflitos */}
            {bloqConflitos.length>0&&(
              <div style={{padding:"16px",background:T.redBg,border:`1px solid ${T.red}30`,borderRadius:8,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:500,color:T.red,marginBottom:10}}>
                  ⚠️ {bloqConflitos.length} consulta{bloqConflitos.length>1?"s":""} agendada{bloqConflitos.length>1?"s":""} neste período
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                  {bloqConflitos.map(ag=>(
                    <div key={ag.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(163,45,45,0.08)",borderRadius:6}}>
                      <span style={{fontSize:14}}>👤</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,color:T.red}}>{ag.pacientes?.nome||"Paciente"}</div>
                        <div style={{fontSize:11,color:T.inkMid}}>{ag.data} às {ag.hora?.slice(0,5)} · {ag.tipo}</div>
                      </div>
                      <Badge label="Será avisado" color={T.orange} bg={T.orangeBg}/>
                    </div>
                  ))}
                </div>
                <div style={{padding:"10px 12px",background:"rgba(163,45,45,0.06)",borderRadius:6,fontSize:12,color:T.red,lineHeight:1.7,borderLeft:`3px solid ${T.red}`}}>
                  Ao confirmar, <strong>todos os pacientes acima receberão uma mensagem automática</strong> informando a indisponibilidade e solicitando que realizem a remarcação. O período será bloqueado imediatamente.
                </div>
              </div>
            )}

            {/* Sem conflitos */}
            {bloqConflitos.length===0&&bloqInicio&&bloqFim&&(
              <div style={{padding:"10px 14px",background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:8,marginBottom:14,fontSize:12,color:T.greenDark}}>
                ✓ Nenhuma consulta agendada neste período — bloqueio pode ser confirmado sem avisos.
              </div>
            )}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn onClick={()=>{setShowBloqueio(false);setBloqConflitos([]);setBloqMotivo("");}} variant="outline">Cancelar</Btn>
              <Btn onClick={handleSalvarBloqueio}
                disabled={bloqSalvando||!bloqInicio||!bloqFim||!bloqMotivo}
                style={{background:T.red}}>
                {bloqSalvando?"Processando...":`🚫 ${bloqConflitos.length>0?`Bloquear e avisar ${bloqConflitos.length} paciente${bloqConflitos.length>1?"s":""}` :"Confirmar bloqueio"}`}
              </Btn>
            </div>
          </Card>
        )}

        {/* Seletor de período */}
        <div style={{display:"flex",gap:0,marginBottom:16,background:T.bgWarm,borderRadius:8,padding:3,width:"fit-content"}}>
          {[
            {id:"proximos",label:"📅 Próximas"},
            {id:"passados",label:"🕐 Passadas"},
            {id:"todos",label:"📋 Todas"},
          ].map(p=>(
            <button key={p.id} onClick={()=>setPeriodo(p.id)}
              style={{padding:"7px 16px",borderRadius:6,border:"none",
                background:periodo===p.id?T.surface:"transparent",
                color:periodo===p.id?T.ink:T.inkMid,
                fontSize:12,cursor:"pointer",fontFamily:T.f,fontWeight:periodo===p.id?500:400,
                boxShadow:periodo===p.id?T.shadow:"none",transition:"all 0.15s"}}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Agenda agrupada por data */}
        {Object.keys(porData).length===0?(
          <Card style={{padding:"40px",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>📅</div>
            <div style={{fontSize:13,color:T.inkFaint}}>
              {periodo==="passados"?"Nenhuma consulta no histórico":"Nenhuma consulta agendada"}
            </div>
          </Card>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {Object.entries(porData).map(([data,ags])=>{
              const d=new Date(data+"T12:00:00");
              const eHoje=data===hoje;
              const passado=data<hoje;
              const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
              const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
              const labelData=eHoje
                ?`Hoje — ${d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}`
                :`${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;

              return(
                <Card key={data} style={{padding:"0",overflow:"hidden",opacity:passado?0.85:1}}>
                  <div style={{
                    padding:"10px 18px",
                    borderBottom:`0.5px solid ${eHoje?T.greenBorder:T.border}`,
                    background:eHoje?T.greenBg:passado?T.bgWarm:"transparent",
                    display:"flex",justifyContent:"space-between",alignItems:"center"
                  }}>
                    <div style={{fontSize:13,fontWeight:500,color:eHoje?T.greenDark:passado?T.inkMid:T.ink}}>
                      {eHoje&&"✦ "}{labelData}
                      {passado&&<span style={{fontSize:10,color:T.inkFaint,marginLeft:8}}>PASSADO</span>}
                    </div>
                    <Badge label={`${ags.length} ${ags.length>1?"consultas":"consulta"}`}
                      color={eHoje?T.green:passado?T.inkFaint:T.blue}
                      bg={eHoje?T.greenBg:T.bgWarm}/>
                  </div>
                  {ags.map(ag=>(
                    ag.status==="bloqueado"?(
                      <div key={ag.id} style={{padding:"10px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,background:T.bgWarm}}>
                        <div style={{textAlign:"center",width:48,flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:600,color:T.inkMid}}>{ag.hora?.slice(0,5)}</div>
                        </div>
                        <div style={{width:1,height:28,background:T.border,flexShrink:0}}/>
                        <div style={{flex:1,fontSize:12,color:T.inkMid}}>🚫 Bloqueado — {ag.resumo||"Indisponível"}</div>
                      </div>
                    ):(
                      <div key={ag.id} style={{padding:"12px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:14,transition:"background 0.12s"}}
                        onMouseOver={e=>e.currentTarget.style.background=T.bgWarm}
                        onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{textAlign:"center",width:48,flexShrink:0}}>
                          <div style={{fontSize:15,fontWeight:600,color:passado?T.inkMid:T.ink}}>{ag.hora?.slice(0,5)}</div>
                          <div style={{fontSize:9,color:T.inkFaint}}>{ag.duracao||30}min</div>
                        </div>
                        <div style={{width:1,height:36,background:T.border,flexShrink:0}}/>
                        <Avatar nome={ag.pacientes?.nome||"?"} size={32} color={passado?T.inkLight:T.green}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500,color:passado?T.inkMid:T.ink}}>{ag.pacientes?.nome||"—"}</div>
                          <div style={{fontSize:11,color:T.inkMid,textTransform:"capitalize"}}>{ag.tipo}{ag.resumo&&` · ${ag.resumo.slice(0,40)}`}</div>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <Badge
                            label={ag.status==="agendado"?"Confirmado":ag.status==="remarcacao_pendente"?"Remarcar":ag.status==="cancelado"?"Cancelado":ag.status==="realizada"?"Realizada":"Confirmado"}
                            color={ag.status==="cancelado"?T.red:ag.status==="remarcacao_pendente"?T.orange:ag.status==="realizada"||passado?T.inkLight:T.green}/>
                          {!passado&&ag.status!=="remarcacao_pendente"&&ag.status!=="cancelado"&&(
                            <>
                              <Btn small variant={eHoje?"primary":"outline"}
                                onClick={()=>onAbrirPaciente(pacientes.find(p=>p.id===ag.paciente_id)||{id:ag.paciente_id,nome:ag.pacientes?.nome},eHoje?ag:null)}>
                                {eHoje?"Iniciar consulta →":"Ver →"}
                              </Btn>
                              {eHoje&&(
                                <Btn small variant="ghost"
                                  style={{color:T.orange,fontSize:11}}
                                  onClick={async()=>{
                                    if(window.confirm("Marcar como não compareceu?")){{
                                      await supabase.from("agendamentos").update({status:"nao_compareceu_paciente"}).eq("id",ag.id);
                                      onAtualizar();
                                    }}
                                  }}>
                                  No-show
                                </Btn>
                              )}
                            </>
                          )}
                          {passado&&(
                            <Btn small variant="ghost"
                              onClick={()=>onAbrirPaciente(pacientes.find(p=>p.id===ag.paciente_id)||{id:ag.paciente_id,nome:ag.pacientes?.nome})}>
                              Ficha →
                            </Btn>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Literatura ───────────────────────────────────────────────────
function TelaLiteratura({apiKey}){
  const[msgs,setMsgs]=useState([{role:"assistant",content:"Olá! Sou seu assistente de literatura científica. Faça uma pergunta clínica e responderei com base em evidências peer-reviewed — NEJM, JAMA, BMJ e mais de 300 revistas indexadas.\n\nExemplos:\n• Conduta para HAS + IRC estágio 3\n• Meta de HbA1c em DM2 com comorbidades\n• Interação metformina + contraste iodado"}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const SUGESTOES=["Conduta HAS + IRC","Meta HbA1c DM2","Estatina em idoso frágil","TRH climatério — riscos","Screening câncer colorretal 45a"];

  const send=async(text)=>{
    if(!text.trim()||loading)return;
    const userMsg={role:"user",content:text};
    setMsgs(prev=>[...prev,userMsg,{role:"assistant",content:"",loading:true}]);
    setInput("");setLoading(true);

    const chave=apiKey||localStorage.getItem("hvv_med_api_key")||"";

    try{
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":chave,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1200,
          system:`Você é um assistente de literatura científica médica. Responda perguntas clínicas com base em evidências peer-reviewed. Cite as fontes (autor, revista, ano). Seja preciso, técnico e use terminologia médica. Ao final de cada resposta, liste as referências usadas. Avise que as respostas devem ser validadas com diretrizes institucionais e julgamento clínico.`,
          messages:msgs.filter(m=>!m.loading).concat(userMsg).map(m=>({role:m.role,content:m.content}))
        })
      });
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

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Header */}
      <div style={{padding:"12px 24px",borderBottom:`0.5px solid ${T.border}`,background:T.surface,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:14,fontWeight:500,color:T.ink}}>Literatura Científica</div>
          <div style={{fontSize:11,color:T.inkMid}}>Respostas baseadas em evidências peer-reviewed</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Badge label="🔬 PubMed" color={T.blue} bg={T.blueBg}/>
          <Badge label="✦ Claude" color={T.green} bg={T.greenBg}/>
        </div>
      </div>

      {/* Mensagens */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {msgs.map((msg,i)=>{
          const isUser=msg.role==="user";
          return(
            <div key={i} style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:10,marginBottom:16,alignItems:"flex-start"}}>
              {!isUser&&<div style={{width:32,height:32,borderRadius:"50%",background:T.blueBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🔬</div>}
              <div style={{maxWidth:"78%",padding:"12px 16px",background:isUser?T.greenBg:T.surface,border:`0.5px solid ${isUser?T.greenBorder:T.border}`,borderRadius:isUser?"12px 12px 4px 12px":"4px 12px 12px 12px",fontSize:13,color:T.ink,lineHeight:1.8,whiteSpace:"pre-wrap"}}>
                {msg.loading?<span style={{display:"inline-flex",gap:4}}>{[0,1,2].map(j=><span key={j} style={{width:5,height:5,borderRadius:"50%",background:T.blue,display:"inline-block",animation:`pulse 1.2s ease ${j*0.2}s infinite`}}/>)}</span>:msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Sugestões */}
      {msgs.length<=1&&(
        <div style={{padding:"0 24px 10px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
          {SUGESTOES.map(s=>(
            <button key={s} onClick={()=>send(s)} style={{padding:"6px 14px",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:20,fontSize:12,color:T.inkMid,cursor:"pointer",fontFamily:T.f}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{borderTop:`0.5px solid ${T.border}`,padding:"12px 24px",flexShrink:0,background:T.surface}}>
        <div style={{fontSize:10,color:T.inkFaint,marginBottom:8}}>⚠️ Valide com diretrizes institucionais antes de decisões clínicas</div>
        <div style={{display:"flex",gap:8}}>
          <textarea ref={inputRef} rows={1} value={input}
            onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}}
            placeholder="Faça uma pergunta clínica..."
            style={{flex:1,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",fontFamily:T.f,fontSize:13,outline:"none",resize:"none",lineHeight:1.5,color:T.ink,background:T.surface}}/>
          <button onClick={()=>send(input)} disabled={loading||!input.trim()}
            style={{width:40,height:40,borderRadius:8,background:(!loading&&input.trim())?T.green:"transparent",border:`1px solid ${(!loading&&input.trim())?T.green:T.border}`,cursor:"pointer",color:(!loading&&input.trim())?"#FFF":T.inkFaint,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {loading?"…":"↑"}
          </button>
        </div>
      </div>
    </div>
  );
}
