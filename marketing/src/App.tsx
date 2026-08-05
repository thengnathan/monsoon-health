// Landing v2 — assembled piece by piece. Current pieces: Hero, Products.
// (The backdrop tuning playground is still reachable at /#playground.)

import { useEffect, useState } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import UnifiedField from './animations/UnifiedField';
import Products from './sections/Products';
import About from './sections/About';
import Playground from './Playground';

export default function App() {
    const [hash, setHash] = useState(window.location.hash);

    useEffect(() => {
        const onHash = () => setHash(window.location.hash);
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    if (hash === '#playground') return <Playground />;

    return (
        <main>
            <UnifiedField />
            <Nav />
            <Hero />
            <Products />
            <About />
        </main>
    );
}
