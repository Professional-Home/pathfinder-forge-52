import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/employees')({
  component: EmployeesPage,
})

function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const { data, error } = await supabase
          .from('employee')
          .select('*')
          .order('emp_id')
        
        if (error) {
          setError(error.message)
        } else {
          setEmployees(data || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchEmployees()
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Employee List (Supabase Connection Test)</h1>
      
      {loading && (
        <div className="flex items-center justify-center p-12">
          <p className="text-lg text-gray-500">Loading employees from Supabase...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">
                Connection Error: {error}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!loading && !error && employees.length === 0 && (
        <div className="bg-yellow-50 p-6 rounded-md border border-yellow-200">
          <p className="text-yellow-700">No employees found. The connection is working, but the table might be empty.</p>
        </div>
      )}

      {!loading && !error && employees.length > 0 && (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg bg-white">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">ID</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Name</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Department</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {employees.map((emp) => (
                <tr key={emp.emp_id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    {emp.emp_id}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {emp.emp_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {emp.department}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600 font-medium">
                    ${emp.salary?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
            <p className="text-sm text-gray-500 text-right">
              Showing <span className="font-medium">{employees.length}</span> records.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
