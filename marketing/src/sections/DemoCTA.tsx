// DemoCTA — "Schedule a demo" button that morphs into a dark liquid-glass
// card (cult-ui ExpandableScreen shared-element transition). The dimmed page
// refracts through the card, and a soft specular sheen follows the cursor —
// like tilting a physical card under a lamp. Used in both the nav and the
// hero with distinct layoutIds.

import {
    ExpandableScreen,
    ExpandableScreenTrigger,
    ExpandableScreenContent,
} from '../animations/expandable-screen';

const CONTACT_EMAIL = 'hello@monsoonhealth.com'; // TODO: confirm the real inbox

export default function DemoCTA({
    layoutId,
    triggerClassName = '',
    labelClassName = '',
}: {
    layoutId: string;
    triggerClassName?: string;
    labelClassName?: string;
}) {
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const subject = encodeURIComponent('Demo request — Monsoon Health');
        const body = encodeURIComponent(
            `Name: ${data.get('name')}\nWork email: ${data.get('email')}\nSite / organization: ${data.get('org')}\n\n${data.get('message') ?? ''}`,
        );
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    };

    // Specular sheen tracks the cursor across the glass
    const onSheenMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--sheen-x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--sheen-y', `${e.clientY - rect.top}px`);
    };
    const onSheenLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        // light drifts back to its resting place at the top edge
        e.currentTarget.style.setProperty('--sheen-x', '50%');
        e.currentTarget.style.setProperty('--sheen-y', '-10%');
    };

    return (
        <ExpandableScreen layoutId={layoutId} triggerRadius="999px" contentRadius="28px" animationDuration={0.45}>
            <ExpandableScreenTrigger className={`demo-cta ${triggerClassName}`}>
                <span className={`demo-cta-label ${labelClassName}`}>Schedule a demo</span>
            </ExpandableScreenTrigger>

            <ExpandableScreenContent className="demo-screen" closeButtonClassName="demo-screen-close">
                <div className="demo-card" onMouseMove={onSheenMove} onMouseLeave={onSheenLeave}>
                    <div className="demo-sheen" aria-hidden="true" />
                    <div className="demo-screen-inner">
                        <span className="demo-screen-eyebrow">Schedule a demo</span>
                        <h2>See your next protocol<br />go live <em className="demo-serif">in minutes.</em></h2>
                        <p>
                            Bring a protocol PDF to the call — we’ll ingest it while you watch:
                            criteria, visit schedule, and screening thresholds, extracted and verified.
                        </p>

                        <form onSubmit={onSubmit}>
                            <div className="demo-form-row">
                                <label>
                                    Name
                                    <input name="name" type="text" placeholder="Dana Rivera" required />
                                </label>
                                <label>
                                    Work email
                                    <input name="email" type="email" placeholder="dana@yoursite.org" required />
                                </label>
                            </div>
                            <label>
                                Site / organization
                                <input name="org" type="text" placeholder="Riverside Clinical Research" />
                            </label>
                            <label>
                                Anything we should know?
                                <textarea name="message" rows={3} placeholder="Trials you're running, EMR, current process…" />
                            </label>
                            <button type="submit" className="demo-submit">Request a demo →</button>
                        </form>

                        <span className="demo-screen-alt">or write to {CONTACT_EMAIL}</span>
                    </div>
                </div>
            </ExpandableScreenContent>
        </ExpandableScreen>
    );
}
