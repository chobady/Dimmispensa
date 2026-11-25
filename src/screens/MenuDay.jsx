import DayAdvice from '../components/DayAdvice.jsx';
import { Talk, useApp } from '../components/ui.jsx';

// Menu del giorno: Gemini, i tuoi dati e i tuoi libri (prima stava in Dispensa)
export default function MenuDay() {
  const { state } = useApp();
  const name = state.user?.name ? `, ${state.user.name.split(' ')[0]}` : '';
  return (
    <>
      <Talk text={`Ciao${name}! Ti preparo il menu di oggi, o solo un pasto, seguendo i tuoi libri e quello che hai in casa.`} mood="happy" />
      <DayAdvice page />
    </>
  );
}
