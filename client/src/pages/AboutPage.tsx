import '../landing.css';

export default function AboutPage() {
    return (
        <div className="landing-page">
            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <a href="/landing" className="landing-nav-brand" style={{ textDecoration: 'none' }}>
                    <svg className="landing-nav-logo" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                        <path d="M16 6 C16 6, 10 16, 10 20 C10 23.3 12.7 26 16 26 C19.3 26 22 23.3 22 20 C22 16 16 6 16 6Z" fill="currentColor" opacity="0.7" />
                        <path d="M16 10 C16 10, 12 17, 12 19.5 C12 22 13.8 24 16 24 C18.2 24 20 22 20 19.5 C20 17 16 10 16 10Z" fill="currentColor" opacity="0.4" />
                    </svg>
                    <span>Monsoon Health</span>
                </a>
                <div className="landing-nav-links">
                    <button className="landing-nav-cta" onClick={() => window.location.href = '/landing'}>
                        Back to Home
                    </button>
                </div>
            </nav>

            {/* ── About Hero ── */}
            <section className="about-hero">
            </section>

            {/* ── Editorial Block ── */}
            <section className="about-editorial">
                <h2 className="editorial-headline">
                    Clinical trials still lose patients to paperwork
                </h2>
                <div className="editorial-body">
                    <p>Every year, 80% of clinical trials fail to meet enrollment deadlines. Sites drown in spreadsheets, fax machines, and disconnected systems. Patients who need experimental treatments the most — those in rural and underserved communities — fall through the cracks before screening even begins.</p>
                    <p>The problem is structural. Clinical research sites run on fragmented workflows built for a different era. Coordinators spend more time on data entry than on patient care. The result are slower trials, higher costs, and entire populations left out of medical progress.</p>
                </div>
                <div className="editorial-mission">
                    <p>Monsoon Health exists to fix clinical trial operations from the ground up. We believe trial access is a systems problem, not a patient problem. Our platform handles compliant screening, onboarding, and lifecycle management for research sites, CROs, and Sponsors — so clinical research teams spend their time where it matters: with patients.</p>
                </div>
                <p className="editorial-tagline">
                    Trial infrastructure is mission-critical,<br />but shouldn't consume your site's bandwidth. That's why it's ours.
                </p>
            </section>

            {/* ── Divider ── */}
            <div className="landing-divider" style={{ marginTop: '0', marginBottom: '4rem' }} />

            {/* ── Team Section ── */}
            <section className="landing-team">
                <h2 className="team-heading">Our company</h2>
                <p className="team-subtitle">Monsoon Health brings deep expertise in clinical operations, health technology, and enterprise software.</p>
                <div className="team-cards">
                    {/* Founder 1 */}
                    <div className="founder-card">
                        <div className="founder-card-top">
                            <img className="founder-photo" src="https://via.placeholder.com/80" alt="[NAME]" />
                            <div>
                                <p className="founder-name">[NAME]</p>
                                <p className="founder-title">[TITLE]</p>
                            </div>
                        </div>
                        <p className="founder-bio">[BIO TEXT]</p>
                    </div>

                    {/* Founder 2 */}
                    <div className="founder-card">
                        <div className="founder-card-top">
                            <img className="founder-photo" src="https://via.placeholder.com/80" alt="[NAME]" />
                            <div>
                                <p className="founder-name">[NAME]</p>
                                <p className="founder-title">[TITLE]</p>
                            </div>
                        </div>
                        <p className="founder-bio">[BIO TEXT]</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
