import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DropZone } from './components/DropZone';
import { ShareRoom } from './components/ShareRoom';
import { ReceiverRoom } from './components/ReceiverRoom';

function RoomRouter() {
  const location = useLocation();
  const isSender = !!location.state?.file;

  return isSender ? <ShareRoom /> : <ReceiverRoom />;
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Routes>
          <Route path="/" element={<DropZone />} />
          <Route path="/room/:roomId" element={<RoomRouter />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
