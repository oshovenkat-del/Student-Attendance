import { Student, AttendanceData } from '../types';

export const INITIAL_STUDENTS: Student[] = [
  { id: 1, enrNumber: "126030", name: "Chimi Rinzin", gender: "M", email: "chimi.rinzin@school.edu", phone: "+975 17112233", notes: "Prefers sitting near the front. Highly collaborative in group assignments." },
  { id: 2, enrNumber: "123578", name: "Choeing Nidhi Lhamo", gender: "F", email: "choeing.lhamo@school.edu", phone: "+975 17223344", notes: "Class representative candidate. Excellent presentation skills." },
  { id: 3, enrNumber: "125599", name: "Jigme Dorji Tobgyal", gender: "M", email: "jigme.tobgyal@school.edu", phone: "+975 17334455", notes: "Active participant in school sports. Very energetic." },
  { id: 4, enrNumber: "126897", name: "Jigme Lhamo Phurba", gender: "F", email: "jigme.phurba@school.edu", phone: "+975 17445566", notes: "Talented in creative writing. Sometimes quiet during discussions." },
  { id: 5, enrNumber: "124717", name: "Jigmed Norbu", gender: "M", email: "jigmed.norbu@school.edu", phone: "+975 17556677", notes: "Strong analytical skills. Often helps peers with mathematics." },
  { id: 6, enrNumber: "127184", name: "Kabish Dhakal", gender: "M", email: "kabish.dhakal@school.edu", phone: "+975 17667788", notes: "Very punctual. Enjoys programming and tech projects." },
  { id: 7, enrNumber: "126707", name: "Karma Wangyal", gender: "M", email: "karma.wangyal@school.edu", phone: "+975 17778899", notes: "Keen interest in history and global affairs. Well-read." },
  { id: 8, enrNumber: "125973", name: "Kelden Tobgay", gender: "M", email: "kelden.tobgay@school.edu", phone: "+975 17889900", notes: "Artistic. Designed the classroom bulletin board." },
  { id: 9, enrNumber: "127071", name: "Kezang Choden", gender: "F", email: "kezang.choden@school.edu", phone: "+975 17990011", notes: "Consistent high-performer. Always submits assignments early." },
  { id: 10, enrNumber: "126085", name: "Kinley Gyeltshen", gender: "M", email: "kinley.gyeltshen@school.edu", phone: "+975 17123456", notes: "Quiet but very observant. Strong in lab sessions." },
  { id: 11, enrNumber: "121817", name: "Kinley Wangchuk", gender: "M", email: "kinley.wangchuk@school.edu", phone: "+975 17234567", notes: "Member of the debate club. Speaks with confidence." },
  { id: 12, enrNumber: "126083", name: "Kinzang Tenzin", gender: "M", email: "kinzang.tenzin@school.edu", phone: "+975 17345678", notes: "Curious learner. Always asks insightful questions in class." },
  { id: 13, enrNumber: "128065", name: "Lakhdhean Nidup Dorji", gender: "M", email: "lakhdhean.dorji@school.edu", phone: "+975 17456789", notes: "Strong logical reasoning. Passionate about physical science." },
  { id: 14, enrNumber: "124928", name: "Lekden Dendup", gender: "M", email: "lekden.dendup@school.edu", phone: "+975 17567890", notes: "Always cheerful. Contributes positively to classroom morale." },
  { id: 15, enrNumber: "126127", name: "Leki Wangmo", gender: "F", email: "leki.wangmo@school.edu", phone: "+975 17678901", notes: "Skilled in organizing events. Very organized note-taker." },
  { id: 16, enrNumber: "125159", name: "Pema Yangden", gender: "F", email: "pema.yangden@school.edu", phone: "+975 17789012", notes: "Soft-spoken. Exceptional attention to detail in laboratory work." },
  { id: 17, enrNumber: "120137", name: "Rechel Zangmo Sherpa", gender: "F", email: "rechel.sherpa@school.edu", phone: "+975 17890123", notes: "Multilingual. Friendly and easily makes friends with everyone." },
  { id: 18, enrNumber: "127024", name: "Rigyel Sapkota", gender: "M", email: "rigyel.sapkota@school.edu", phone: "+975 17901234", notes: "Enthusiastic about science projects. Eager to try new tools." },
  { id: 19, enrNumber: "126482", name: "Sanjog Mongar", gender: "M", email: "sanjog.mongar@school.edu", phone: "+975 170123456", notes: "Hardworking. Showing steady improvement in all subjects." },
  { id: 20, enrNumber: "127406", name: "Sonam Choki", gender: "F", email: "sonam.choki@school.edu", phone: "+975 17111222", notes: "Class safety monitor. Responsible and dependable." },
  { id: 21, enrNumber: "126522", name: "Sonam Palden", gender: "F", email: "sonam.palden@school.edu", phone: "+975 17222333", notes: "Avid reader. Excels in literature and reading comprehension." },
  { id: 22, enrNumber: "127092", name: "Sonam Wangmo", gender: "F", email: "sonam.wangmo@school.edu", phone: "+975 17333444", notes: "Creative mind. Excellent in visual diagrams and charts." },
  { id: 23, enrNumber: "125964", name: "Sonam Yuden", gender: "F", email: "sonam.yuden@school.edu", phone: "+975 17444555", notes: "Enjoys biology and environment studies. Green team volunteer." },
  { id: 24, enrNumber: "126896", name: "Sonam Zangmo", gender: "F", email: "sonam.zangmo@school.edu", phone: "+975 17555666", notes: "Very methodical in mathematical calculations. Quiet and focused." },
  { id: 25, enrNumber: "125561", name: "Tashi Tshering Tenzin", gender: "M", email: "tashi.tenzin@school.edu", phone: "+975 17666777", notes: "Tech enthusiast. Assists teacher with projector setups." },
  { id: 26, enrNumber: "115903", name: "Tenzin Choda", gender: "M", email: "tenzin.choda@school.edu", phone: "+975 17777888", notes: "Good sportsmanship. Captain of the football squad." },
  { id: 27, enrNumber: "126835", name: "Tenzin Dem", gender: "F", email: "tenzin.dem@school.edu", phone: "+975 17888999", notes: "Compassionate. Always helps clean the lab spaces." },
  { id: 28, enrNumber: "127633", name: "Tenzin Namgay", gender: "M", email: "tenzin.namgay@school.edu", phone: "+975 17999000", notes: "Fascinated by geology. Great collection of rock samples." },
  { id: 29, enrNumber: "115520", name: "Tenzin Zomkee", gender: "F", email: "tenzin.zomkee@school.edu", phone: "+975 17111333", notes: "Attentive student. Excellent performance in quizzes." },
  { id: 30, enrNumber: "126112", name: "Thinley Gyeltshen", gender: "M", email: "thinley.gyeltshen@school.edu", phone: "+975 17222444", notes: "Critical thinker. Leads classroom debate preparations." },
  { id: 31, enrNumber: "120880", name: "Thinley Yoezer Dorji", gender: "M", email: "thinley.dorji@school.edu", phone: "+975 17333555", notes: "Excellent musical talent. Plays guitar for school assemblies." },
  { id: 32, enrNumber: "124716", name: "Tshering Tobgyel", gender: "M", email: "tshering.tobgyel@school.edu", phone: "+975 17444666", notes: "Hardworking. Highly focused on chemistry experiments." },
  { id: 33, enrNumber: "126510", "name": "Ugyen Dema", gender: "F", email: "ugyen.dema@school.edu", phone: "+975 17555777", notes: "Has perfect attendance so far. Active member of eco-club." },
  { id: 34, enrNumber: "128285", name: "Yetsho Lhamo Dorji", gender: "F", email: "yetsho.dorji@school.edu", phone: "+975 17666888", notes: "Exceptional language skills. Writes beautiful school articles." }
];

// Generate standard default attendance for the current month up to today to make the sandbox mode look rich!
const today = new Date();
export const CURRENT_YEAR = today.getFullYear();
export const CURRENT_MONTH_INDEX = today.getMonth(); // 0-indexed
export const CURRENT_MONTH_NAME = today.toLocaleString('en-US', { month: 'long' });
export const CURRENT_DATE_STRING = `${CURRENT_YEAR}-${String(CURRENT_MONTH_INDEX + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export const generateDefaultAttendance = (): AttendanceData => {
  const data: AttendanceData = {};
  
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const currentDate = today.getDate();

  const daysToPrefill: string[] = [];
  
  // We'll prefill all weekdays from the 1st of the current month up to today (or up to the 25th if early in the month to showcase a rich UI)
  const targetEndDay = Math.max(currentDate, 25);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const limitDay = Math.min(targetEndDay, daysInMonth);

  for (let d = 1; d <= limitDay; d++) {
    const tempDate = new Date(year, month, d);
    const dayOfWeek = tempDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Weekdays only
      const yyyy = tempDate.getFullYear();
      const mm = String(tempDate.getMonth() + 1).padStart(2, '0');
      const dd = String(tempDate.getDate()).padStart(2, '0');
      daysToPrefill.push(`${yyyy}-${mm}-${dd}`);
    }
  }

  daysToPrefill.forEach((date) => {
    data[date] = {};
    INITIAL_STUDENTS.forEach((student) => {
      // 88% chance Present, 8% Absent, 4% Late
      const rand = Math.random();
      let status: 'P' | 'A' | 'L' = 'P';
      if (rand < 0.08) {
        status = 'A';
      } else if (rand < 0.12) {
        status = 'L';
      }
      data[date][student.enrNumber] = status;
    });
  });

  return data;
};
