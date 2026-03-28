import { useEffect } from 'react';
import '../landing.css';

export default function AboutPage() {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('scroll-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        document.querySelectorAll('.scroll-animate').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="landing-page">
            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <a href="/landing" className="landing-nav-brand" style={{ textDecoration: 'none' }}>
                    <img src="/images/monsoon-braid-wordmark-white.svg" alt="Monsoon Health" className="landing-nav-wordmark" />
                </a>
                <div className="landing-nav-links">
                    <button className="landing-nav-cta" onClick={() => window.location.href = '/landing'}>
                        Back to Home
                    </button>
                </div>
            </nav>

            {/* ── About Hero ── */}
            <section className="about-hero">
                <img
                    className="about-hero-img"
                    src="/images/Company_Background.png"
                    alt="Monsoon Health team"
                />
                <div className="about-hero-fade" />
            </section>

            {/* ── Editorial Block ── */}
            <section className="about-editorial">
                <h2 className="editorial-headline scroll-animate scroll-fade-up">
                    Clinical trials still lose patients to paperwork
                </h2>
                <div className="editorial-body scroll-animate scroll-fade-up" style={{ transitionDelay: '0.1s' }}>
                    <p>Every year, 80% of clinical trials fail to meet enrollment deadlines. Sites drown in spreadsheets, fax machines, and disconnected systems. Patients who need experimental treatments the most, those in rural and underserved communities, fall through the cracks before screening even begins.</p>
                    <p>The problem is structural. Clinical research sites run on fragmented workflows built for a different era. Coordinators spend more time on data entry than on patient care. The result are slower trials, higher costs, and entire populations left out of medical progress.</p>
                </div>
                <div className="editorial-mission scroll-animate scroll-fade-up" style={{ transitionDelay: '0.2s' }}>
                    <p>Monsoon Health exists to fix clinical trial operations from the ground up. We believe trial access is a systems problem, not a patient problem. Our platform handles compliant screening, onboarding, and lifecycle management for research sites, CROs, and Sponsors, so clinical research teams spend their time where it matters, with patients.</p>
                </div>
                <p className="editorial-tagline scroll-animate scroll-fade-up" style={{ transitionDelay: '0.3s' }}>
                    Trial infrastructure is mission-critical,<br />but shouldn't consume your site's bandwidth. That's why it's ours.
                </p>
            </section>

            {/* ── Divider ── */}
            <div className="landing-divider" style={{ marginTop: '0', marginBottom: '4rem' }} />

            {/* ── Team Section ── */}
            <section className="landing-team">
                <h2 className="team-heading scroll-animate scroll-fade-up">Our Team</h2>
                <p className="team-subtitle scroll-animate scroll-fade-up" style={{ transitionDelay: '0.1s' }}>Ashman, Nathan, and Amin met while working together as clinical research coordinators on hepatology and liver cirrhosis clinical trials, where they developed deep expertise in clinical operations and health technology. Together, they bring strong experience at the intersection of research execution and digital health innovation.</p>
                <div className="team-cards">
                    {/* Founder 1 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Ashman.png" alt="Ashman Dosanjh" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Ashman Dosanjh</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>

                    {/* Founder 2 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0.15s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Nathan.png" alt="Nathan Theng" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Nathan Theng</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>

                    {/* Founder 3 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0.3s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Amin.png" alt="Amin Joseph" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Amin Joseph</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
