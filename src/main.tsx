import { createRoot } from 'react-dom/client';
import App from './App';
import ToastViewport from './components/Toast';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('DUBI console root is missing');
createRoot(root).render(<><App /><ToastViewport/></>);

import "./workspace.css";
