import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export const DestinationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    if (!id) return <Navigate to="/dashboard" replace />;
    return <Navigate to={`/listings/activity/${id}`} replace />;
};

