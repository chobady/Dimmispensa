import DayAdvice from '../components/DayAdvice.jsx';
import { Talk, useApp } from '../components/ui.jsx';

// Menu del giorno: calcolato in locale (lib/planner.js) con i tuoi dati e la dispensa
export default function MenuDay() {
  const { state } = useApp();
  const name = state.user?.name ? `, ${state.user.name.split(' ')[0]}` : '';
  return (
    <>
      <Talk text={`Ciao${name}! Ti preparo il menu di oggi, o solo un pasto, con le regole del Manuale e di Project Nutrition e quello che hai in casa. I conti li faccio io, al grammo.`} mood="happy" />
      <DayAdvice page />
    </>
  );
}
