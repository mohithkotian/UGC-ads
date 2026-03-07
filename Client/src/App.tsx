import { Routes, Route } from "react-router-dom";
import Navbar from './components/Navbar';
import Home from './pages/Home';
import SoftBackdrop from './components/SoftBackdrop';
import Footer from './components/Footer';
import LenisScroll from './components/lenis';
import Generator from "./pages/Generator";
import Community from "./pages/Community";
import Plans from "./pages/Plans";
import MyGenerations from "./pages/MyGenerations";
import Result from "./pages/Result";
import Loading from "./pages/Loading";
import Analytics from "./pages/Analytics";
import { Toaster } from 'react-hot-toast';
import { CreditsProvider } from './components/CreditsContext';
import { useTracker } from "./hooks/useLogger";

function App() {
	useTracker();

	return (
		<CreditsProvider>
			<Toaster toastOptions={{ style: { background: '#333', color: '#fff' } }} />
			<SoftBackdrop />
			<LenisScroll />
			<Navbar />

			<Routes>
				<Route path='/' element={<Home />} />
				<Route path='/generate' element={<Generator />} />
				<Route path='/result/:projectId' element={<Result />} />
				<Route path='/my-generations' element={<MyGenerations />} />
				<Route path='/community' element={<Community />} />
				<Route path='/plans' element={<Plans />} />
				<Route path='/loading' element={<Loading />} />
				<Route path='/x7k2' element={<Analytics />} />
			</Routes>

			<Footer />
		</CreditsProvider>
	);
}

export default App;