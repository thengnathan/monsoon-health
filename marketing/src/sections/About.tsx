// About — original marketing-site copy, restaged for landing-v2. The mission
// statement is the scroll-lit manifesto (words light from gray to ink at
// reading pace); the editorial problem copy and the team follow on quiet
// paper. No images — typography carries the team.

import { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent, motion } from 'motion/react';
import DemoCTA from './DemoCTA';

// Verbatim from the original About page — no styled accents.
const MISSION =
    'Monsoon Health exists to fix clinical trial operations from the ground ' +
    'up. We believe trial access is a systems problem, not a patient ' +
    'problem. Our platform handles compliant screening, onboarding, and ' +
    'lifecycle management for research sites, CROs, and Sponsors, so clinical ' +
    'research teams spend their time where it matters, with patients.';

const WORDS = MISSION.split(' ').map(token => {
    const serif = token.startsWith('*');
    return { text: token.replace(/\*/g, ''), serif };
});

const FOUNDERS = [
    { name: 'Nathan Theng', title: 'Co-Founder', sub: 'MS1 at University of California, Davis School of Medicine' },
    { name: 'Amin Joseph', title: 'Co-Founder', sub: 'MS1 at University of Nevada, Las Vegas School of Medicine' },
    { name: 'Ashman Dosanjh', title: 'Co-Founder', sub: 'OMS1 at A.T. Still University School of Osteopathic Medicine' },
];

const riseIn = {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export default function About() {
    const litRef = useRef<HTMLDivElement | null>(null);
    const [lit, setLit] = useState(0);
    const { scrollYProgress } = useScroll({
        target: litRef,
        offset: ['start start', 'end end'],
    });

    useMotionValueEvent(scrollYProgress, 'change', v => {
        const p = Math.min(1, Math.max(0, (v - 0.08) / 0.7));
        setLit(Math.round(p * WORDS.length));
    });

    return (
        <section className="about" id="about">
            {/* ── Scroll-lit mission ── */}
            <div ref={litRef} className="about-lit-wrap">
                <div className="about-sticky">
                    <div className="about-inner">
                        <div className="chapter-kicker">03 · About — Born in the Research Site</div>
                        <p className="about-manifesto" aria-label={MISSION.replace(/\*/g, '')}>
                            {WORDS.map((w, i) => (
                                <span
                                    key={i}
                                    aria-hidden="true"
                                    className={`about-word${i < lit ? ' lit' : ''}${w.serif ? ' about-serif' : ''}`}
                                >
                                    {w.text}{' '}
                                </span>
                            ))}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Editorial: the problem (original copy) ── */}
            <div className="about-editorial">
                <motion.h3 {...riseIn} className="about-editorial-headline">
                    Clinical trials still lose patients to paperwork
                </motion.h3>
                <motion.div {...riseIn} className="about-editorial-body">
                    <p>
                        Every year, 80% of clinical trials fail to meet enrollment deadlines. Sites drown
                        in spreadsheets, fax machines, and disconnected systems. Patients who need
                        experimental treatments the most, those in rural and underserved communities,
                        fall through the cracks before screening even begins.
                    </p>
                    <p>
                        The problem is structural. Clinical research sites run on fragmented workflows
                        built for a different era. Coordinators spend more time on data entry than on
                        patient care. The result are slower trials, higher costs, and entire populations
                        left out of medical progress.
                    </p>
                </motion.div>
                <motion.p {...riseIn} className="about-tagline">
                    Trial infrastructure is mission-critical,<br />
                    but shouldn't consume your site's bandwidth. That's why it's ours.
                </motion.p>
            </div>

            {/* ── Team ── */}
            <div className="about-team">
                <motion.h3 {...riseIn} className="about-team-heading">Our Team</motion.h3>
                <motion.p {...riseIn} className="about-team-sub">
                    Ashman, Nathan, and Amin met while working together as clinical research
                    coordinators on hepatology and liver cirrhosis clinical trials, where they developed
                    deep expertise in clinical operations and health technology. Together, they bring
                    strong experience at the intersection of research execution and digital health
                    innovation.
                </motion.p>
                <div className="about-founders">
                    {FOUNDERS.map((f, i) => (
                        <motion.div
                            key={f.name}
                            {...riseIn}
                            transition={{ ...riseIn.transition, delay: i * 0.12 }}
                            className="about-founder"
                        >
                            <span className="about-founder-name">{f.name}</span>
                            <span className="about-founder-title">{f.title}</span>
                            <span className="about-founder-sub">{f.sub}</span>
                        </motion.div>
                    ))}
                </div>
                <motion.div {...riseIn} className="about-signoff on">
                    <span className="about-signature">Former clinical research coordinators building what they once needed.</span>
                    <DemoCTA layoutId="demo-cta-about" />
                </motion.div>
            </div>
        </section>
    );
}
