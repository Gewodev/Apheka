from pathlib import Path
p=Path('src/lib/notifications.ts');s=p.read_text('utf-8').replace("|'downloads';id?:string;date?:string}","|'downloads'|'habits';id?:string;date?:string;action?:'start-break'|'start-session'}")
s=s.replace('export function notifySessionComplete(minutes: number): void {', '''export const STUDY_NOTICE_KEY='apheka_study_notice';
export const STUDY_NOTICE_PENDING='apheka_study_notice_pending';
export function createStudyNotice(action:'start-break'|'start-session'):NotificationTarget {
 const target:NotificationTarget={kind:'study',action,id:crypto.randomUUID()};
 try{sessionStorage.setItem(STUDY_NOTICE_KEY,JSON.stringify(target));}catch{}
 return target;
}
export function notifySessionComplete(minutes: number): void {''')
s=s.replace('`Has completado ${minutes} minutos de trabajo dedicado. Toma un descanso merecido.`','`Has completado ${minutes} minutos de trabajo dedicado. Puedes guardar este bloque e iniciar el descanso.`,createStudyNotice(\'start-break\')')
s=s.replace("'Tu pausa ha terminado. Inicia tu siguiente bloque de estudio con mente fresca.'","'Tu pausa ha terminado. Inicia tu siguiente bloque de estudio con mente fresca.',createStudyNotice('start-session')")
p.write_text(s,'utf-8')
p=Path('src/components/NotificationNavigation.tsx');s=p.read_text('utf-8').replace("import type {NotificationTarget}","import {STUDY_NOTICE_KEY,STUDY_NOTICE_PENDING} from '../lib/notifications';\nimport type {NotificationTarget}")
s=s.replace("case 'study':app.setNavigateTo('estudio');break;", """case 'study':
     if(target.action&&target.id){try{const expected=JSON.parse(sessionStorage.getItem(STUDY_NOTICE_KEY)||'null');if(expected?.id===target.id&&expected?.action===target.action){sessionStorage.setItem(STUDY_NOTICE_PENDING,JSON.stringify(target));}}catch{}}
     app.setNavigateTo('estudio');window.dispatchEvent(new Event('apheka:study-notice'));break;
    case 'habits':if(target.date)sessionStorage.setItem('apheka_habit_focus_date',target.date);sessionStorage.setItem('apheka_open_habits','1');app.setNavigateTo('planificacion');window.dispatchEvent(new Event('apheka:open-habits'));break;""")
p.write_text(s,'utf-8')
p=Path('src/components/views/Estudio.tsx');s=p.read_text('utf-8').replace('notifySessionComplete, notifyBreakOver, sendNativeNotification','notifySessionComplete, notifyBreakOver, sendNativeNotification, STUDY_NOTICE_KEY, STUDY_NOTICE_PENDING');s=s.replace("        sendNativeNotification('Sesión completada', 'Buen trabajo. Evalúa tu sesión.');\n",'')
needle='  // No restStartRef needed'
s=s.replace(needle,'''  // A toast can execute once, only while the exact phase it describes is still valid.
  const noticeHandlerRef=useRef<()=>void>(()=>{});
  noticeHandlerRef.current=()=>{try{
    const raw=sessionStorage.getItem(STUDY_NOTICE_PENDING);if(!raw)return;
    sessionStorage.removeItem(STUDY_NOTICE_PENDING);
    const target=JSON.parse(raw),expected=JSON.parse(sessionStorage.getItem(STUDY_NOTICE_KEY)||'null');
    if(!expected||expected.id!==target.id||expected.action!==target.action)return;
    sessionStorage.removeItem(STUDY_NOTICE_KEY);
    if(sessionType!=='pomodoro'||isRest||isTimerActive)return;
    if(target.action==='start-break'&&sessionTime>=settings.pomodoroTime)handleEvalAndStartRest({});
    else if(target.action==='start-session'&&sessionTime===0)setIsTimerActive(true);
  }catch{}};
  useEffect(()=>{const run=()=>noticeHandlerRef.current();run();window.addEventListener('apheka:study-notice',run);return()=>window.removeEventListener('apheka:study-notice',run);},[]);

'''+needle)
p.write_text(s,'utf-8')
p=Path('src/store/AppContext.tsx');s=p.read_text('utf-8').replace('addHabit: (name: string) => void;','addHabit: (name: string, options?: Pick<Habit, \'metricKind\'|\'dailyGoal\'>) => void;').replace('const addHabit = useCallback((name: string) => {',"const addHabit = useCallback((name: string, options?: Pick<Habit, 'metricKind'|'dailyGoal'>) => {")
s=s.replace('      name: name.trim(),\n      completedOn: [],','      name: name.trim(),\n      ...options,\n      completedOn: [],',1);p.write_text(s,'utf-8')
p=Path('src/components/views/Planificacion.tsx');s=p.read_text('utf-8');pos=s.index('  const [showHabits,');end=s.index('  const ',pos+8);s=s[:end]+'''  useEffect(()=>{const open=()=>{if(sessionStorage.getItem('apheka_open_habits')){sessionStorage.removeItem('apheka_open_habits');setShowHabits(true);setShowScheduleBuilder(false);}};open();window.addEventListener('apheka:open-habits',open);return()=>window.removeEventListener('apheka:open-habits',open);},[]);
'''+s[end:];p.write_text(s,'utf-8')
