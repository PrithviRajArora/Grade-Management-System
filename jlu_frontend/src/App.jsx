import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import Courses       from './pages/Courses'
import CourseDetail  from './pages/CourseDetail'
import Analytics     from './pages/Analytics'
import Students      from './pages/Students'
import StudentReport from './pages/StudentReport'
import Profile       from './pages/Profile'
import AdminPanel    from './pages/AdminPanel'
import NotFound      from './pages/NotFound'
import ExamAttempts  from './pages/ExamAttempts'
import Backlogs      from './pages/Backlogs'

function WithLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"               element={<WithLayout><Dashboard /></WithLayout>} />
            <Route path="/courses"        element={<WithLayout><Courses /></WithLayout>} />
            <Route path="/courses/:code"  element={<WithLayout><CourseDetail /></WithLayout>} />
            <Route path="/analytics"      element={<WithLayout><Analytics /></WithLayout>} />
            <Route path="/students"       element={<WithLayout><Students /></WithLayout>} />
            <Route path="/students/:id"   element={<WithLayout><StudentReport /></WithLayout>} />
            <Route path="/my-results"     element={<WithLayout><StudentReport /></WithLayout>} />
            <Route path="/profile"        element={<WithLayout><Profile /></WithLayout>} />
            <Route path="/admin"          element={<WithLayout><AdminPanel /></WithLayout>} />
            <Route path="/exam-attempts"  element={<WithLayout><ExamAttempts /></WithLayout>} />
            <Route path="/backlogs"       element={<WithLayout><Backlogs /></WithLayout>} />
            <Route path="/my-backlogs"    element={<WithLayout><Backlogs /></WithLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
