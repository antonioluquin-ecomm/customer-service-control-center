// ================================================================
// CALCULATIONS — funciones puras de cálculo
// ================================================================
const avg = arr => arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) : 0;
const getUMB = () => ({excelente:CFG.u_excelente, correcta:CFG.u_correcta});
const calcEstado = g => { const U=getUMB(); return g>=U.excelente?"Excelente":g>=U.correcta?"Correcta":"Observada"; };
const estadoBadge = e => e==="Excelente"?"badge-excelente":e==="Correcta"?"badge-correcta":"badge-observada";
const estadoSB = e => e==="Excelente"?"sb-green":e==="Correcta"?"sb-amber":"sb-red";
const calcGeneral = (cal,prod) => Math.round((cal*CFG.w_calidad + prod*CFG.w_productividad)/100);
const calcObjetivo = hs => hs ? Math.round(Number(hs)*(CFG.tickets_base/CFG.horas_base)) : 0;

// Usa el snapshot de criterios si el formulario está activo
const activeCriterios = () => (_criteriosSnapshot||CRITERIOS).filter(c=>c.activo);

// Calcula semana ISO desde una fecha "YYYY-MM-DD"
function getISOWeek(dateStr){
  if(!dateStr) return "";
  const d=new Date(dateStr+"T12:00:00");
  const temp=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  temp.setUTCDate(temp.getUTCDate()+4-(temp.getUTCDay()||7));
  const yearStart=new Date(Date.UTC(temp.getUTCFullYear(),0,1));
  return String(Math.ceil((((temp-yearStart)/86400000)+1)/7));
}

// Al cambiar fecha: actualiza mes y semana automáticamente
function onFechaChange(){
  const fecha=v("f-fecha");
  if(!fecha) return;
  const meses=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const d=new Date(fecha+"T12:00:00");
  document.getElementById("f-mes").value=meses[d.getMonth()];
  document.getElementById("f-semana").value=getISOWeek(fecha);
  updateHorasBanner();
  updateSemanaCount();
}
