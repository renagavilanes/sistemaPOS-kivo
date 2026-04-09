import { Product, Client } from '../types';

// Mock products data
export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Café Americano',
    price: 2.50,
    cost: 1.50,
    stock: 50,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    name: 'Cappuccino',
    price: 3.50,
    cost: 2.10,
    stock: 45,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    name: 'Croissant',
    price: 2.00,
    cost: 1.20,
    stock: 30,
    category: 'Panadería',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop'
  },
  {
    id: '4',
    name: 'Sandwich',
    price: 5.50,
    cost: 3.30,
    stock: 25,
    category: 'Comida',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop'
  },
  {
    id: '5',
    name: 'Té Verde',
    price: 2.00,
    cost: 1.20,
    stock: 60,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop'
  },
  {
    id: '6',
    name: 'Muffin',
    price: 2.50,
    cost: 1.50,
    stock: 20,
    category: 'Panadería',
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=300&fit=crop'
  },
  {
    id: '7',
    name: 'Ensalada',
    price: 6.00,
    cost: 3.60,
    stock: 15,
    category: 'Comida',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
  },
  {
    id: '8',
    name: 'Jugo Natural',
    price: 3.00,
    cost: 1.80,
    stock: 35,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop'
  },
];

export const categories = ['Todas', 'Bebidas', 'Comida', 'Panadería'];

export const expenseCategories = [
  'Productos',
  'Servicios',
  'Marketing',
  'Mantenimiento',
  'Salarios',
  'Otros',
];

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    phone: '+1234567890',
    email: 'juan@example.com',
  },
  {
    id: '2',
    name: 'María García',
    phone: '+1234567891',
    email: 'maria@example.com',
  },
  {
    id: '3',
    name: 'Carlos López',
    phone: '+1234567892',
    email: 'carlos@example.com',
  },
];