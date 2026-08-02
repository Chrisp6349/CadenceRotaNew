// -----------------------------------------------------------------------
// theatre-history.js
// "Today in Cardiothoracic History" — a small, factual daily card for the
// Theatre Board. Pilot batch: a first set of genuine, individually
// researched and sourced anniversaries (not the full 365-day year yet).
// Deliberately NOT auto-generated or invented — every entry below has a
// verifiable date and at least one real source. Days without an entry
// here just don't show the card (see loadTodayHistory()), rather than
// showing a placeholder — that's better than guessing at history.
//
// To add a future month's batch: append more objects to ENTRIES, each
// keyed by "month" (1-12) and "day". Nothing else in this file, or in
// corridor-board.html's use of it, needs to change.
// -----------------------------------------------------------------------

export const ENTRIES = [
  {
    month: 1, day: 6, year: 1968,
    type: "On This Day",
    category: "Heart Transplant",
    title: "The First US Adult Heart Transplant",
    summary: "At Stanford University Hospital, Norman Shumway led the first heart transplant performed on an adult in the United States, just five weeks after Christiaan Barnard's operation in Cape Town. The recipient, 54-year-old steelworker Mike Kasperak, lived for 14 days. Shumway's own transplant research at Stanford through the 1960s — refining rejection surveillance and surgical technique on dogs — had quietly laid much of the groundwork Barnard's team drew on.",
    whyItMatters: "The biopsy-based rejection surveillance Shumway's team pioneered afterwards became standard practice, and Stanford's transplant programme he built is still one of the most influential in the world.",
    didYouKnow: "Shumway is sometimes called \"the father of heart transplantation\" for the years of groundwork behind the operation, even though Barnard performed the first one.",
    tags: ["Heart transplant", "Norman Shumway", "Stanford"],
    sources: ["Stanford Medicine — stanmed.stanford.edu", "Britannica — Norman E. Shumway"]
  },
  {
    month: 3, day: 9, year: 1981,
    type: "On This Day",
    category: "Heart Transplant",
    title: "The First Successful Heart-Lung Transplant",
    summary: "Bruce Reitz and the Stanford team performed the world's first successful combined heart-lung transplant on Mary Gohlke, a 45-year-old newspaper executive with primary pulmonary hypertension. The operation relied on cyclosporine, a then-new anti-rejection drug, to succeed where earlier attempts at replacing both organs together had failed. Gohlke was discharged after 82 days and returned to work.",
    whyItMatters: "It proved combined heart-lung transplantation was viable and helped establish cyclosporine as the drug that made modern transplant medicine possible across every organ, not just the heart.",
    didYouKnow: "Gohlke had written to Reitz's research team after reading a newspaper article about their work — she was, in effect, her own referral.",
    tags: ["Heart-lung transplant", "Bruce Reitz", "Stanford", "Cyclosporine"],
    sources: ["Stanford Medicine — Scope blog", "The Journal of Thoracic and Cardiovascular Surgery"]
  },
  {
    month: 3, day: 26, year: 1954,
    type: "On This Day",
    category: "Congenital Cardiac Surgery",
    title: "Cross-Circulation: Operating With a Living Heart-Lung Machine",
    summary: "C. Walton Lillehei repaired a ventricular septal defect in a one-year-old boy using \"cross-circulation\" — temporarily connecting the child's circulation to his father's, so the father's own heart and lungs oxygenated blood for them both during surgery. It was the first series of successful open-heart operations for congenital defects anywhere, performed a year before mechanical heart-lung machines were reliable enough for routine use.",
    whyItMatters: "Cross-circulation itself was abandoned within a couple of years once bypass machines improved, but the case series it produced proved open repair of complex congenital defects was survivable — a turning point for the whole field.",
    didYouKnow: "Because a parent's own vital organs were put at risk to save their child, Lillehei's technique became known as the only operation in history with a potential mortality rate of 200%.",
    tags: ["Congenital", "Walton Lillehei", "Cross-circulation", "VSD"],
    sources: ["The Annals of Thoracic Surgery — \"Our Surgical Heritage\"", "University of Minnesota Medical School"]
  },
  {
    month: 4, day: 4, year: 1969,
    type: "On This Day",
    category: "Innovation",
    title: "The First Artificial Heart Implant",
    summary: "At St Luke's Episcopal Hospital in Houston, Denton Cooley implanted the first total artificial heart — designed by Domingo Liotta — into Haskell Karp, keeping him alive for 64 hours as a bridge until a donor heart was found. Karp received a transplant but died shortly after. The operation was performed without the device's usual review process, sparking a bitter, decades-long dispute between Cooley and Michael DeBakey, in whose lab the device had been developed.",
    whyItMatters: "It was the first proof that a mechanical device could keep a person alive long enough to reach transplant — the idea behind every ventricular assist device and bridge-to-transplant therapy used today.",
    didYouKnow: "The controversy over how the device was obtained led directly to tighter institutional review requirements for experimental surgery in the US.",
    tags: ["Artificial heart", "Denton Cooley", "Domingo Liotta", "Bridge to transplant"],
    sources: ["Smithsonian Magazine", "National Museum of American History"]
  },
  {
    month: 4, day: 5, year: 1933,
    type: "On This Day",
    category: "Thoracic Surgery",
    title: "The First Successful Pneumonectomy for Lung Cancer",
    summary: "Evarts Graham removed an entire lung from Dr James Gilmore, a fellow physician, after finding the cancer was more extensive than expected during surgery. Asked whether the procedure had ever been done before, Graham reportedly answered that he'd only done it in animals — but didn't see why it couldn't work in a person. Gilmore lived cancer-free for a further 24 years.",
    whyItMatters: "It was the first time lung cancer had been successfully treated by surgery, establishing pneumonectomy — and, later, the more conservative lobectomy — as viable treatment rather than a death sentence.",
    didYouKnow: "Graham himself later became a heavy smoker and died of lung cancer in 1957, having spent his final years helping publicise the smoking-cancer link.",
    tags: ["Thoracic surgery", "Evarts Graham", "Pneumonectomy", "Lung cancer"],
    sources: ["JAMA", "The Journal of Thoracic and Cardiovascular Surgery"]
  },
  {
    month: 5, day: 6, year: 1953,
    type: "On This Day",
    category: "Perfusion",
    title: "The Heart-Lung Machine's First Success",
    summary: "John Gibbon closed an atrial septal defect in 18-year-old Cecelia Bavolek at Jefferson Medical College, keeping her circulation running on his own heart-lung machine for 26 minutes. It was the culmination of over 20 years of work — Gibbon had first conceived the idea in 1931, watching a patient die from a blocked pulmonary artery, and spent two decades refining the oxygenator with his wife and research partner, Mary Hopkinson Gibbon.",
    whyItMatters: "Every open-heart operation performed since — CABG, valve replacement, congenital repair — depends on the basic principle Gibbon proved that day: that a machine can safely take over for the heart and lungs while a surgeon works.",
    didYouKnow: "Gibbon was so shaken by two earlier deaths on the machine that he stopped operating on it for nearly a year before Bavolek's case.",
    tags: ["Perfusion", "John Gibbon", "Heart-lung machine", "Bypass"],
    sources: ["WHYY", "National Inventors Hall of Fame"]
  },
  {
    month: 5, day: 9, year: 1967,
    type: "On This Day",
    category: "CABG",
    title: "The First Documented Coronary Bypass",
    summary: "René Favaloro, an Argentine surgeon working at the Cleveland Clinic, performed the first documented coronary artery bypass using a saphenous vein graft, on a 51-year-old woman with a blocked right coronary artery. He went on to perform 13 more cases that year, publishing his results in 1968. Favaloro had trained under Mason Sones, whose new coronary angiography technique — see 30 October — first made it possible to actually see the blockages surgeons were now bypassing.",
    whyItMatters: "CABG using a vein graft became the most common form of open-heart surgery worldwide for the rest of the century, and the technique — a segment of saphenous vein routed around a blockage — is still recognisably the same operation today.",
    didYouKnow: "Favaloro later returned to Argentina to found a foundation focused on medical education and equitable healthcare access, which still operates today.",
    tags: ["CABG", "Rene Favaloro", "Saphenous vein graft", "Cleveland Clinic"],
    sources: ["The Journal of Thoracic and Cardiovascular Surgery", "Encyclopedia of Cleveland History"]
  },
  {
    month: 6, day: 5, year: 1929,
    type: "On This Day",
    category: "Pioneers",
    title: "A Young Doctor Catheterises His Own Heart",
    summary: "Werner Forssmann, then a 25-year-old surgical resident in Germany, threaded a catheter through a vein in his own arm and, guided by an X-ray mirror, walked to the fluoroscopy room and confirmed its tip had reached his right atrium. He had proposed the idea to access the heart safely for treatment; when his supervisor refused to allow it, he tried it on himself instead. The stunt cost him his job.",
    whyItMatters: "Forssmann's self-experiment proved the heart could be safely accessed via a catheter, opening the door to every diagnostic and interventional catheter procedure used in cardiology today — angiography, angioplasty, and structural interventions alike.",
    didYouKnow: "Forssmann shared the 1956 Nobel Prize in Physiology or Medicine for the discovery, decades after it nearly ended his career.",
    tags: ["Pioneers", "Werner Forssmann", "Cardiac catheterisation", "Nobel Prize"],
    sources: ["Mayo Clinic Proceedings", "Wikipedia — Werner Forssmann"]
  },
  {
    month: 6, day: 10, year: 1948,
    type: "On This Day",
    category: "Valve Surgery",
    title: "The First Successful Mitral Valve Repair",
    summary: "Charles Bailey performed a successful closed mitral commissurotomy — widening a narrowed mitral valve using a finger and blade passed into the beating heart — on 24-year-old Claire Ward in Philadelphia. She lived for a further 38 years. Bailey had lost four consecutive patients to the same operation beforehand and was reportedly close to being barred from performing it again. Six days later, Dwight Harken achieved the same success independently in Boston.",
    whyItMatters: "It proved that a diseased heart valve could be treated directly, without a heart-lung machine, and opened the door to the valve repair and replacement surgery performed routinely today.",
    didYouKnow: "Bailey and Harken had been fierce rivals for years, both racing to be first to a working mitral operation — and ended up succeeding within a week of each other.",
    tags: ["Valve surgery", "Charles Bailey", "Dwight Harken", "Mitral stenosis"],
    sources: ["The Annals of Thoracic Surgery — \"Classics in Thoracic Surgery\"", "Wikipedia — Charles P. Bailey"]
  },
  {
    month: 6, day: 11, year: 1963,
    type: "On This Day",
    category: "Thoracic Surgery",
    title: "The First Human Lung Transplant",
    summary: "James Hardy and his team at the University of Mississippi transplanted a lung into John Russell, a 58-year-old prisoner whose own lung was destroyed by cancer. Russell survived 18 days before dying of kidney failure, but the transplanted lung itself functioned well throughout — proof the operation itself could work, even though long-term success was still two decades away. The case, remarkably, took place the same day as the assassination of civil rights leader Medgar Evers in the same city.",
    whyItMatters: "It was the proof of surgical concept that later, better-supported lung transplant programmes — starting with Toronto's in 1983 — were built on.",
    didYouKnow: "Hardy's team had practised the technique in more than 400 animal transplants before ever attempting it in a person.",
    tags: ["Thoracic surgery", "James Hardy", "Lung transplant"],
    sources: ["University of Mississippi Medical Center", "The Annals of Thoracic Surgery"]
  },
  {
    month: 7, day: 10, year: 1893,
    type: "On This Day",
    category: "Pioneers",
    title: "Daniel Hale Williams Repairs a Torn Heart",
    summary: "At Provident Hospital in Chicago — a hospital he had founded two years earlier, the first in the US with an interracial staff — Daniel Hale Williams repaired the pericardium of James Cornish, a man stabbed in a bar fight. Working without antibiotics, blood transfusion, or any of the imaging surgeons rely on today, Williams opened the chest, controlled the bleeding, and closed the wound. Cornish lived for at least another 20 years.",
    whyItMatters: "It's widely regarded as one of the earliest successful cardiac operations on record, performed by a surgeon who also devoted his career to building medical institutions that trained and treated people excluded elsewhere.",
    didYouKnow: "Williams was one of the founding members of the National Medical Association in 1895, formed because Black physicians were barred from the then-segregated American Medical Association.",
    tags: ["Pioneers", "Daniel Hale Williams", "Pericardium", "Provident Hospital"],
    sources: ["Britannica — Daniel Hale Williams", "Columbia Surgery"]
  },
  {
    month: 9, day: 9, year: 1896,
    type: "On This Day",
    category: "Pioneers",
    title: "The First Successful Heart Surgery",
    summary: "In Frankfurt, Ludwig Rehn sutured a stab wound to the right ventricle of 22-year-old William Justus, who had been knifed two nights earlier. Until that point, surgery on the heart itself was widely considered impossible — an earlier survey had put the survival rate for cardiac wounds at around 10%, and most surgeons believed operating on a beating heart would kill the patient outright. Justus recovered fully.",
    whyItMatters: "Rehn's operation is generally regarded as the birth of cardiac surgery as a discipline — the first hard evidence that the heart itself could be operated on and survived.",
    didYouKnow: "Rehn went on to become one of the most respected surgeons in Germany, but this single case — reported to a sceptical surgical society — is what he's remembered for.",
    tags: ["Pioneers", "Ludwig Rehn", "Cardiorrhaphy", "World first"],
    sources: ["The Annals of Thoracic Surgery — \"Classics in Thoracic Surgery\"", "Wikipedia — Ludwig Rehn"]
  },
  {
    month: 10, day: 8, year: 1958,
    type: "On This Day",
    category: "Innovation",
    title: "The First Implantable Pacemaker",
    summary: "Swedish engineer Arne Larsson, disabled by complete heart block, became the first person to receive a fully implantable pacemaker, built by engineer Rune Elmqvist and implanted by surgeon Åke Senning. The device — housed in a polished shoe-polish tin — failed within hours and was replaced the same day. Larsson went on to outlive both Elmqvist and Senning, living another 43 years and receiving 26 further pacemakers as the technology improved around him.",
    whyItMatters: "It proved a device could be safely implanted to regulate the heart's own rhythm long-term — the foundation every modern pacemaker and implantable defibrillator builds on.",
    didYouKnow: "Larsson later became a vocal advocate for pacemaker patients and campaigned for their availability across Europe until his death in 2001.",
    tags: ["Innovation", "Pacemaker", "Ake Senning", "Arne Larsson"],
    sources: ["Wikipedia — Arne Larsson (patient)", "Siemens Healthineers Medical Museum"]
  },
  {
    month: 10, day: 30, year: 1958,
    type: "On This Day",
    category: "Innovation",
    title: "The Accidental Discovery of Coronary Angiography",
    summary: "At the Cleveland Clinic, Mason Sones was attempting to image the heart valves of a 26-year-old patient when the catheter tip slipped and injected contrast dye directly into the right coronary artery. Expecting the patient's heart to stop, Sones instead watched the artery appear clearly on the X-ray screen — the first time a coronary artery had ever been directly visualised in a living patient. The patient was unharmed.",
    whyItMatters: "Coronary angiography — now performed millions of times a year — became the standard way to diagnose blocked coronary arteries, and directly enabled the bypass surgery pioneered less than a decade later.",
    didYouKnow: "Sones reportedly shouted for the patient to cough forcefully to help clear the dye — the patient did, and was fine.",
    tags: ["Innovation", "Mason Sones", "Coronary angiography", "Cleveland Clinic"],
    sources: ["Cureus", "PCR Online"]
  },
  {
    month: 11, day: 7, year: 1983,
    type: "On This Day",
    category: "Thoracic Surgery",
    title: "The First Successful Long-Term Lung Transplant",
    summary: "At Toronto General Hospital, Joel Cooper transplanted a single lung into Tom Hall, who had pulmonary fibrosis. Earlier lung transplant attempts worldwide — including James Hardy's in 1963 — had all failed within weeks, largely due to problems with the airway healing. Cooper's team had spent years studying exactly why those airway connections kept failing before attempting the operation again. Hall lived an active life for six more years.",
    whyItMatters: "It marked the point where lung transplantation went from a proof of concept to a genuinely viable treatment, founding the Toronto programme that trained many of the surgeons who built lung transplant programmes worldwide.",
    didYouKnow: "The breakthrough that made it possible was largely about surgical technique and steroid management around the airway anastomosis, not a new drug or device.",
    tags: ["Thoracic surgery", "Joel Cooper", "Lung transplant", "Toronto"],
    sources: ["University Health Network, Toronto", "CBC News"]
  },
  {
    month: 11, day: 29, year: 1944,
    type: "On This Day",
    category: "Congenital Cardiac Surgery",
    title: "The First Blue Baby Operation",
    summary: "At Johns Hopkins, surgeon Alfred Blalock and paediatric cardiologist Helen Taussig operated on 15-month-old Eileen Saxon, connecting a subclavian artery to a pulmonary artery to improve blood flow to her lungs — treating the cyanosis of tetralogy of Fallot for the first time. The technique had been developed and refined over years of animal research by Vivien Thomas, a laboratory technician without a formal medical degree, who stood on a step stool guiding Blalock through the operation itself.",
    whyItMatters: "The Blalock-Taussig(-Thomas) shunt is still used today, largely unchanged, as a treatment or bridge-to-repair for cyanotic congenital heart defects in newborns.",
    didYouKnow: "Vivien Thomas received no formal recognition from Johns Hopkins for decades; the institution awarded him an honorary doctorate and a faculty appointment only in 1976.",
    tags: ["Congenital", "Blalock-Taussig shunt", "Vivien Thomas", "Blue baby"],
    sources: ["Johns Hopkins Medicine", "The Journal of Thoracic and Cardiovascular Surgery"]
  },
  {
    month: 12, day: 2, year: 1982,
    type: "On This Day",
    category: "Innovation",
    title: "The First Permanent Artificial Heart",
    summary: "William DeVries implanted the Jarvik-7, a permanent mechanical heart, into 61-year-old retired dentist Barney Clark at the University of Utah — the first attempt at using an artificial heart as a lifelong replacement rather than a temporary bridge to transplant. The overnight surgery ran from 11:27pm to around 6am. Clark lived for 112 days, tethered to an air compressor the size of a washing machine, before dying of complications unrelated to the device itself.",
    whyItMatters: "Though the permanent artificial heart never became routine, the case shaped the ethical and regulatory framework — informed consent, quality of life during experimental therapy — that still governs high-risk experimental surgery today.",
    didYouKnow: "The Jarvik-7 is named after Robert Jarvik, but was built on years of earlier work by Willem Kolff's lab, where Jarvik himself was a researcher.",
    tags: ["Innovation", "Artificial heart", "Jarvik-7", "William DeVries"],
    sources: ["TIME", "University of Utah Health"]
  },
  {
    month: 12, day: 3, year: 1967,
    type: "On This Day",
    category: "Heart Transplant",
    title: "The World's First Heart Transplant",
    summary: "At Groote Schuur Hospital in Cape Town, Christiaan Barnard transplanted the heart of Denise Darvall, a young woman fatally injured in a car accident, into Louis Washkansky, a 53-year-old man dying of heart disease. The nine-hour operation began shortly after midnight; Washkansky's new heart was shocked into action just before 6am. He survived 18 days before dying of pneumonia, his new heart still functioning normally throughout.",
    whyItMatters: "It proved a human heart transplant was technically achievable, launching a wave of transplant attempts worldwide and, eventually — once anti-rejection drugs caught up — the routine, life-saving procedure it is today.",
    didYouKnow: "Barnard had trained partly under Norman Shumway's Stanford team's published techniques; Shumway himself performed the first US adult heart transplant just five weeks later, on 6 January.",
    tags: ["Heart transplant", "Christiaan Barnard", "World first", "Groote Schuur"],
    sources: ["HISTORY.com", "University of Cape Town — Chris Barnard Division of Cardiothoracic Surgery"]
  },
  {
    month: 12, day: 6, year: 1967,
    type: "On This Day",
    category: "Congenital Cardiac Surgery",
    title: "America's First Heart Transplant — On a Newborn",
    summary: "Three days after Christiaan Barnard's landmark operation, Adrian Kantrowitz performed the first heart transplant in the United States, at Maimonides Medical Center in New York — on a 19-day-old infant with a severe congenital heart defect. The baby survived just six and a half hours. Kantrowitz had been quietly preparing for the operation for months, aware Barnard's team was racing toward the same goal.",
    whyItMatters: "Despite its brief outcome, it was the first evidence that transplantation could be attempted even in the smallest, most fragile patients — a field that today gives infants born with otherwise fatal heart defects a genuine chance at survival.",
    didYouKnow: "Kantrowitz later shifted his research toward mechanical circulatory support, developing an early implantable heart pump that was a forerunner of today's ventricular assist devices.",
    tags: ["Heart transplant", "Adrian Kantrowitz", "Congenital", "World first"],
    sources: ["The Washington Post", "Wikipedia — Adrian Kantrowitz"]
  }
];

function dayKey(month, day) { return `${month}-${day}`; }

const BY_DAY = new Map(ENTRIES.map(e => [dayKey(e.month, e.day), e]));

// Returns today's entry, or null on a day the pilot batch doesn't cover
// yet — corridor-board.html simply doesn't render the card on those days,
// rather than showing a placeholder.
export function todaysHistoryEntry(now = new Date()) {
  return BY_DAY.get(dayKey(now.getMonth() + 1, now.getDate())) || null;
}
